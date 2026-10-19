# Optional Amazon Bedrock AgentCore deployment

AgentCore is an optional deployment target for the Strands-powered agent. FixRelay's primary Alexa+ MCP server is a separate endpoint (`/mcp`); deploying the agent to AgentCore does not replace or automatically register that server as an Alexa+ integration.

## Preconditions

- A working FixRelay app and a reachable, secured MCP endpoint.
- AWS credentials configured for the target account and region.
- Bedrock model access enabled for `BEDROCK_MODEL_ID` in that region.
- The current official AgentCore CLI and a supported TypeScript/Strands template, following the live AWS documentation.
- Review the expected runtime, IAM permissions, network access, CloudWatch logging, data handling and cost before deploying.

## Recommended procedure

1. Verify the live Strands + Bedrock path locally using `npm run aws:verify`.
2. From the official AWS AgentCore TypeScript quickstart, scaffold a TypeScript project using the current Strands framework option. CLI flags change over time; follow the live guide rather than copying stale flags from an old tutorial.
3. Move only the agent entrypoint and necessary configuration into the generated runtime project. Configure the MCP endpoint through an environment variable and use authentication for remote deployments.
4. Run the runtime locally using the CLI's documented dev command, then deploy to a non-production environment.
5. Invoke the deployed endpoint with a harmless read-only question. Confirm that it returns a real Bedrock-backed result and records expected runtime logs.
6. Capture the deployment and invocation result. Only then claim AgentCore in Devpost feedback.
7. Stop or delete resources after testing and check CloudWatch/AWS billing. Do not deploy from CI using personal long-lived access keys.

## Official documentation

- [AgentCore Runtime TypeScript quickstart](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli-typescript.html)
- [Amazon Bedrock user guide](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- [Strands Agents TypeScript SDK](https://github.com/strands-agents/harness-sdk/tree/main/strands-ts)

**Verification status:** this repository does not claim an AgentCore deployment until the AWS account owner follows the above process and records a successful deployment and invocation.
