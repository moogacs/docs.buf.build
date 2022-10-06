---
id: usage
title: Usage
---

> We highly recommend completing [the tour](../tour/configure-and-build.md) to get an overview of `buf build`.

All `buf` operations rely on building, or compiling, Protobuf files. The [linter](../lint/overview.md),
[breaking change detector](../breaking/overview.md), [generator](../generate/usage.md),
and the [BSR](../bsr/overview.md) are features that rely on compilation results. In its simplest form,
the `buf build` command is used to verify that an [input](../reference/inputs.md) compiles.

## Configuration

`buf` is configured with the [`buf.yaml`](../configuration/v1/buf-yaml.md) configuration file, which is placed
at the root of the Protobuf source files it defines. The placement of the `buf.yaml` configuration tells `buf`
where to search for `.proto` files, and how to handle imports. As opposed to `protoc`, where all `.proto` files
are manually specified on the command-line, `buf` operates by recursively discovering all `.proto` files under
configuration and building them.

Here is an example of all configuration options for `build`:

```yaml title="buf.yaml"
version: v1
build:
  excludes:
    - foo/bar
```

The `build` section only has one option:

### `excludes`

The `excludes` key is **optional**, and lists directories to ignore from `.proto` file discovery. Any directories
added to this list are completely skipped and excluded in the result. **We do not recommend using this
option in general**, however in some situations it is unavoidable.

For more information on `buf.yaml` configuration, see the [reference](../configuration/v1/buf-yaml.md).

### Default values

In `buf`'s default input mode, it assumes there is a `buf.yaml` in your current directory, or uses
the default values in lieu of a `buf.yaml` file. We recommend always having a `buf.yaml` file at the
root of your `.proto` files hierarchy, as this is how `.proto` import paths are resolved.

## Define a Module

To get started, create a [module](../bsr/overview.md#modules) by adding a `buf.yaml` file to the root of the directory
that contains your Protobuf definitions. You can create the default `buf.yaml` file with this command:

```terminal
$ buf mod init
```

```yaml title="buf.yaml"
version: v1
breaking:
  use:
    - FILE
lint:
  use:
    - DEFAULT
```

## Modules and workspaces

For those of you that have used `protoc`, the placement of the `buf.yaml` is analogous to a `protoc`
include (`-I`) path. **With `buf`, there is no `-I` flag** - each `protoc` `-I` path maps to a directory
that contains a `buf.yaml` (called a module in Buf parlance), and multiple modules are stitched
together with a [`buf.work.yaml`](../configuration/v1/buf-work-yaml.md), which defines a [workspace](../reference/workspaces.md).

To illustrate how all these pieces fit together here's a quick example using `protoc` and its equivalent
in `buf`:

```terminal
$ protoc \
    -I proto \
    -I vendor/protoc-gen-validate \
    -o /dev/null \
    $(find proto -name '*.proto')
```

A `buf.yaml` would be placed in the `proto` and `vendor/protoc-gen-validate` directories, and you would define
a `buf.work.yaml` that contains this:

```sh {8,11}
.
├── buf.work.yaml
├── proto
│   ├── acme
│   │   └── weather
│   │       └── v1
│   │           └── weather.proto
│   └── buf.yaml
└── vendor
    └── protoc-gen-validate
        ├── buf.yaml
        └── validate
            └── validate.proto
```

```yaml title="buf.work.yaml"
version: v1
directories:
  - proto
  - vendor/protoc-gen-validate
```

Like the `-I` flag for `protoc`, workspaces make it possible to import definitions across modules, such as introducing
a new `message` in one module, and importing it from another. Similarly, any command that is run on an input that contains
a `buf.work.yaml` acts upon *all* of the modules defined in the `buf.work.yaml`.

## Workspace requirements

There are two additional requirements that `buf` imposes on your `.proto` file structure
for compilation to succeed that are not enforced by `protoc`, both of which are essential to
successful modern Protobuf development across a number of languages.

**1. Workspace modules must not overlap, that is one workspace module can not be a sub-directory of another workspace module.**

This, for example, is not a valid configuration:

```yaml title="buf.work.yaml"
version: v1
# THIS IS INVALID AND RESULTS IN A PRE-COMPILATION ERROR
directories:
  - foo
  - foo/bar
```

This is important to make sure that across all your `.proto` files, imports are consistent.
In the above example, for a given file `foo/bar/bar.proto`, it would be valid to import
this file as either `bar/bar.proto` or `bar.proto`. Having inconsistent imports leads
to a number of major issues across the Protobuf plugin ecosystem.

**2. All `.proto` file paths must be unique relative to each workspace module.**

For example, consider this configuration:

```yaml title="buf.work.yaml"
version: v1
directories:
  - foo
  - bar
```

*Given the above configuration, it's invalid to have these two files:*

  - `foo/baz/baz.proto`
  - `bar/baz/baz.proto`

This results in two files having the path `baz/baz.proto`. Imagine that a third file is thrown into
the mix:

```protobuf title="bar/baz/bat.proto"
// THIS IS DEMONSTRATING SOMETHING BAD
syntax = "proto3";

package bar.baz;

import "baz/baz.proto";
```

Which file is being imported here? Is it `foo/baz/baz.proto`? `bar/baz/baz.proto`? The answer depends
on the order of the `-I` flags given to `protoc`, or (if `buf` didn't error in this scenario
pre-compilation, which `buf` does) the order of the imports given to the
[internal compiler](../reference/internal-compiler.md). If the authors are being honest, we can't
remember if it's the first `-I` or second `-I` that wins - we have outlawed this in our own builds for a long time.

While the above example is relatively contrived, the common error that comes up is when you
have vendored `.proto` files. For example, [grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway/tree/cc01a282127b54a81f92d6b8e8fb8971dab8be9b/third_party/googleapis)
has its own copy of the [google.api](https://github.com/googleapis/googleapis/tree/master/google/api) definitions it needs.
While these are usually in sync, the `google.api` schema can change. Imagine that we allowed this:

```yaml
version: v1
# THIS IS INVALID AND RESULTS IN A PRE-COMPILATION ERROR
directories:
  - proto
  - vendor/github.com/googleapis/googleapis
  - vendor/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis
```

Which copy of `google/api/*.proto` wins? The answer: no one wins. So Buf doesn't allow this.

## Run build

You can run `buf build` on your module by specifying the filepath to the directory containing the
`buf.yaml` configuration file. To target the module defined in the current directory:

```terminal
$ buf build
```

The `buf build` command:

  - Discovers all Protobuf files per your `buf.yaml` configuration.
  - Copies the Protobuf files into memory.
  - Compiles all Protobuf files.
  - Outputs the compiled result to a configurable location (defaults to `/dev/null`)

If there are errors, they are printed out in a `file:line:column:message` format by default.
For example:

```terminal
$ buf build
---
acme/pet/v1/pet.proto:5:8:acme/payment/v1alpha1/payment.proto: does not exist
```

Build output can also be printed as JSON:

```terminal
$ buf build --error-format=json
---
{"path":"acme/pet/v1/pet.proto","start_line":5,"start_column":8,"end_line":5,"end_column":8,"type":"COMPILE","message":"acme/payment/v1alpha1/payment.proto: does not exist"}
```

## Output format

By default, `buf build` outputs its result to `/dev/null`. In this case, it's common to use
`buf build` as a validation step, analogous to checking if the input compiles.

`buf build` also supports outputting [`FileDescriptorSet`s](https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/descriptor.proto)
and [Images](../reference/images.md), which is Buf's custom extension of the `FileDescriptorSet`. Better yet, these outputs
can be formatted in a variety of ways.

`buf build` can deduce the output format by the file extension, see the documentation on [automatically derived formats](../reference/inputs.md#automatically-derived-formats). For example,

```terminal
$ buf build -o image.bin
$ buf build -o image.bin.gz
$ buf build -o image.bin.zst
$ buf build -o image.json
$ buf build -o image.json.gz
$ buf build -o image.json.zst
```

The special value `-` is used to denote stdout, and you can manually set the format. For example:

```terminal
$ buf build -o -#format=json
```

When combined with [jq](https://stedolan.github.io/jq), `buf build` also allows for introspection. For example,
to see a list of all packages, you can run this command:

```terminal
$ buf build -o -#format=json | jq '.file[] | .package' | sort | uniq | head
---
"google.actions.type"
"google.ads.admob.v1"
"google.ads.googleads.v1.common"
"google.ads.googleads.v1.enums"
"google.ads.googleads.v1.errors"
"google.ads.googleads.v1.resources"
"google.ads.googleads.v1.services"
"google.ads.googleads.v2.common"
"google.ads.googleads.v2.enums"
"google.ads.googleads.v2.errors"
```

Images always include the `ImageExtension` field. But if you want a pure `FileDescriptorSet` without
this field set, and thus to mimic `protoc` entirely, you can use the `--as-file-descriptor-set` flag:

```terminal
$ buf build -o image.bin --as-file-descriptor-set
```

The `ImageExtension` field doesn't affect Protobuf plugins or any other operations, as they merely see this as an unknown
field. But we provide the option in case you want it.

## Limit to specific files

By default, `buf` builds all files under the `buf.yaml` configuration file. You can instead manually specify the
file or directory paths to build. This is an advanced feature intended to be used for editor or
[Bazel](/build-systems/bazel.md) integration - it
is better to let `buf` discover all files under management and handle this for you in general.

The compiled result is limited to the given files if the `--path` flag is specified, as in this
command:

```terminal
$ buf build --path path/to/foo.proto --path path/to/bar.proto
```

## Limit to specific types

When you run `buf build` to create a [`FileDescriptorSet`][filedescriptorset] or Buf [image], the
output contains all of the Protobuf types declared in the [module] by default. But for some advanced
use cases, you may want the image or `FileDescriptorSet` to contain only a subset of the types
described in your Protobuf API.

Versions 1.1.0 and later of the `buf` CLI include a `--type` option for the `buf build` command that
enables you to supply a fully qualified Protobuf name and limit the resulting image or
`FileDescriptorSet` to only those descriptors required to represent those types and their required
dependencies. This example usage restricts the output types to those required to represent
`pkg.foo.Bar`:

```terminal
$ buf build --type pkg.foo.Bar
```

The `--type` flag accepts fully qualified names for [messages], [enums], and [services]. These
dependent descriptors are included in the build:

- [Messages]
  - Messages and enums referenced in message fields
  - Any [proto2] extension declarations for message fields
  - The parent message if this message is a nested definition
  - Any custom options for the message, its fields, and the file in which the message is defined
- [Enums]
  - The enum value descriptors for this enum
  - The parent message is this enum is a nested definition
  - Any custom options for the enum, enum values, and the file in which the enum is defined
- [Services]
  - Request and response types referenced in service methods
  - Any custom options for the services, its methods, and the file in which the service is defined

:::success Supplying multiple types
You can specify multiple types by applying the `--type` option multiple times, as in this example:

```terminal
$ buf build \
  --type acme.weather.v1.Units \
  --type acme.weather.v1.CurrentWeather.Temperature
```

In this case, dependent descriptors for both `acme.weather.v1.Units` and
`acme.weather.v1.CurrentWeather.Temperature` are included in the output.
:::

### Type restriction example

As an example, consider these two `.proto` files:

```protobuf title="foo.proto"
package pkg;
message Foo {
  optional Bar bar = 1;
  extensions 2 to 3;
}
message Bar { ... }
message Baz {
  other.Qux qux = 1 [(other.my_option).field = "buf"];
}
```

```protobuf title="bar.proto"
package other;
extend Foo {
  optional Qux baz = 2;
}
message Qux{ ... }
message Quux{ ... }
extend google.protobuf.FieldOptions {
  optional Quux my_option = 51234;
}
```

This table shows which files, messages, and extensions would be included for various types from
`foo.proto` and `bar.proto` if specified as the argument to `--type`:

Type | Files | Messages | Extensions
:----|:------|:---------|:----------
`buf build --type pkg.Foo` | `foo.proto`, `bar.proto` | `pkg.Foo`, `pkg.Bar`, `other.Qux` | `other.baz`
`buf build --type pkg.Bar` | `foo.proto` | `pkg.Bar` | |
`buf build --type pkg.Baz` | `foo.proto`, `bar.proto` | `pkg.Baz`, `other.Quux`, `other.Qux` | `other.my_option`

## Docker

Buf ships a Docker image [bufbuild/buf](https://hub.docker.com/r/bufbuild/buf) that enables
you to use `buf` as part of your Docker workflow. For example:

```terminal
$ docker run \
  --volume "$(pwd):/workspace" \
  --workdir /workspace \
  bufbuild/buf build
```

[enums]: https://developers.google.com/protocol-buffers/docs/proto3#enum
[filedescriptorset]: https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/descriptor.proto
[image]: ../reference/images.md
[messages]: https://developers.google.com/protocol-buffers/docs/proto3#simple
[module]: ../bsr/overview.md#modules
[proto2]: https://developers.google.com/protocol-buffers/docs/proto
[services]: https://developers.google.com/protocol-buffers/docs/proto3#services
