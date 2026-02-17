import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/core",
    "@aws-sdk/credential-provider-node",
    "@aws-sdk/middleware-host-header",
    "@aws-sdk/middleware-logger",
    "@aws-sdk/middleware-recursion-detection",
    "@aws-sdk/middleware-user-agent",
    "@aws-sdk/region-config-resolver",
    "@aws-sdk/types",
    "@aws-sdk/util-endpoints",
    "@aws-sdk/util-user-agent-browser",
    "@aws-sdk/util-user-agent-node",
    "@smithy/config-resolver",
    "@smithy/core",
    "@smithy/fetch-http-handler",
    "@smithy/hash-node",
    "@smithy/invalid-dependency",
    "@smithy/middleware-content-length",
    "@smithy/middleware-endpoint",
    "@smithy/middleware-retry",
    "@smithy/middleware-serde",
    "@smithy/middleware-stack",
    "@smithy/node-config-provider",
    "@smithy/node-http-handler",
    "@smithy/protocol-http",
    "@smithy/smithy-client",
    "@smithy/types",
    "@smithy/url-parser",
    "@smithy/util-base64",
    "@smithy/util-body-length-browser",
    "@smithy/util-body-length-node",
    "@smithy/util-defaults-mode-browser",
    "@smithy/util-defaults-mode-node",
    "@smithy/util-endpoints",
    "@smithy/util-middleware",
    "@smithy/util-retry",
    "@smithy/util-stream",
    "@smithy/util-utf8",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.s3.**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "s3.**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "dayo-profile.s3.ap-northeast-2.amazonaws.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
