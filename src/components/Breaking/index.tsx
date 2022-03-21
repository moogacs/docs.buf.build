import clsx from 'clsx';
import React from 'react';

type Props = {
  feature: string;
  article: string;
  version: string;
};

const Breaking = ({ feature, article, version }: Props) => {
  return (
    <div className={clsx("admonition", "admonition-warning", "alert", "alert--warning")}>
      <h5 className="admonition-heading">Breaking change warning</h5>

      <p>
        {feature} is currently {article} <strong>{version}</strong> feature. Although you're free to
        experiment with it, be aware that we're likely to make breaking changes that may affect your
        workflows.
      </p>
    </div>
  );
};

export default Breaking;
