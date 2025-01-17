---
id: go
title: Go
---

import Breaking from "@site/src/components/Breaking";

<Breaking 
  feature="Remote code generation for Go"
  version="alpha"
/>

The [Buf Schema Registry](../../bsr/overview.md) (BSR) supports [remote code
generation](../overview.md) for [Go]. With this feature, you can push [Buf modules][modules] to the
BSR and `go get` Go code stubs generated from those Protobuf definitions&mdash;without ever needing to
generate code on your own. Go source code generated by the BSR is hosted on the BSR's [Go module
proxy](#proxy).

With this feature, you no longer need to maintain Protobuf files or runtime dependencies like
[protoc] plugins&mdash;in fact, JavaScript and TypeScript developers can avoid local code generation
altogether for any Buf modules that have been pushed to the BSR.

This feature is especially useful for creating API clients for Go, as it provides consumers of your
API with generated Go SDKs on demand. With remote generation, you no longer need to generate Go code
from Protobuf locally, and thus no longer need to maintain Protobuf files or protoc-based plugins.

## BSR Go module proxy {#proxy}

The BSR Go module proxy implements the [GOPROXY protocol][goproxy] for [Buf modules][modules] by
generating assets on the fly&mdash;Go code stubs aren't generated until you request them using
`go get`.

The key to consuming from the BSR Go module proxy is choosing the right **Go module path**. The
import path for generated Go code has this format:

import Syntax from "@site/src/components/Syntax";

<Syntax
	title="Generated Go module path syntax"
	examples={[
		"go.buf.build/grpc/go/bufbuild/eliza"
	]}
	segments={[
		{"label": "go.buf.build", "kind": "constant"},
		{"separator": "/"},
		{"label": "templateOwner", "kind": "variable", href: "/bsr/remote-generation/overview#templates"},
		{"separator": "/"},
		{"label": "templateName", "kind": "variable", href: "/bsr/remote-generation/overview#templates"},
		{"separator": "/"},
		{"label": "moduleOwner", "kind": "variable", href: "/bsr/overview#modules"},
		{"separator": "/"},
		{"label": "moduleName", "kind": "variable", href: "/bsr/overview#modules"},
	]}
/>

So if you wanted to, for example, generate the [`acme/paymentapis`][api] Protobuf module using the
[`grpc/go`][grpc-go] template, you could install the generated code like this:

```terminal
$ go get go.buf.build/grpc/go/acme/paymentapis
```

You can use _any_ template that generates Go, which can simplify Protobuf workflows down to two
steps:

1. `buf push` your [module][modules] to the BSR
1. `go get` your generated Go module

## Try it out!

In this example, we'll use the Go gRPC client for the [Eliza demo][connect-demo] service. Since
this is a gRPC/Protobuf API we get a generated client SDK with minimal effort. The
[`grpc/go`][grpc-go] template is used to generate the [`bufbuild/eliza`][eliza-module] module.

See the [above](#proxy) for a refresher on Go module import paths.

```go {9}
package main

import (
	"context"
	"crypto/tls"
	"log"

	// Import the Eliza API definitions and generate using the template grpc/go.
	elizav1 "go.buf.build/grpc/go/bufbuild/eliza/buf/connect/demo/eliza/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

func main() {
	cc, err := grpc.Dial(
		"demo.connect.build:443",
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})),
	)
	if err != nil {
		log.Fatalf("Failed to dial GCS API: %v", err)
	}
	client := elizav1.NewElizaServiceClient(cc)
	resp, err := client.Say(context.Background(), &elizav1.SayRequest{
		Sentence: "Hello remote generation",
	})
	if err != nil {
		log.Fatalf("Failed to get bucket: %v", err)
	}
	log.Println(resp)
}

```

If you're using Go modules you'll observe a version such as `v1.4.6` in the `go.mod` file. To
better understand versioning, see the [synthetic versions](overview.md#synthetic-versions)
documentation.

```sh title="go.mod"
require (
	go.buf.build/grpc/go/bufbuild/eliza v1.4.6
)
```

## Generate private modules {#private}

To generate Go code from private modules you'll need to make sure the Go tooling is correctly configured.

1. Log into the BSR:

	The `go` tool uses [`.netrc` credentials][netrc] if available and you can use `buf registry login` to add this to your `.netrc` file.
	You can obtain an API token (password) from the [Settings page][settings].

	```terminal
	$ buf registry login
	```

	```sh title="~/.netrc"
	machine buf.build
			login <USERNAME>
			password <TOKEN>
	machine go.buf.build
			login <USERNAME>
			password <TOKEN>
	```

2. Go Environment Configuration

	The `GOPRIVATE` environment variable controls which modules the `go` command considers to be
	private and thus shouldn't use the proxy or checksum database. This is important since you don't
	want to send private information to the default Go module proxy at https://proxy.golang.org.

	Set this environment variable:

	```terminal
	$ export GOPRIVATE=go.buf.build
	```

	If you already have `GONOSUMDB` configured, you also need to add `go.buf.build` to it:

	```terminal
	$ export GONOSUMDB=$GONOSUMDB,go.buf.build
	```

   This isn't necessary if you do not already have `GONOSUMDB` configured, as `GOPRIVATE`
	 automatically sets it in this case.

   For more information, see the official [private modules documentation][private].

[api]: https://buf.build/acme/paymentapis
[go]: https://golang.org
[eliza-module]: https://buf.build/bufbuild/eliza/
[connect-demo]: https://github.com/bufbuild/connect-demo
[goproxy]: https://golang.org/ref/mod#goproxy-protocol
[grpc-go]: https://buf.build/grpc/templates/go
[modules]: ../overview.md#modules
[netrc]: https://golang.org/ref/mod#private-module-proxy-auth
[private]: https://golang.org/ref/mod#private-modules
[settings]: https://buf.build/settings/user
[storage]: https://cloud.google.com/storageb
