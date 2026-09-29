# DG-24 — AWS catalog metadata fill

The AWS catalog now contains **246 complete entries out of 273 shipped icons** (90.1%): 245 additions and the existing Glue seed with an additive capability. The actual `catalog_missing` result is **27**. Every written entry is `curated: false`; maintainer review is still required. Glue's existing name, description, docs URL, tags and curation state are unchanged.

## Method and result

The tracked `fill-catalog` prompt was retrieved through MCP. All catalog writes used the local `catalog_update` tool: eleven initial batches of at most 25 entries, followed by a two-entry identity/retirement correction and a seven-entry sunset correction after independent review. No YAML was edited by hand. The initial loop wrote 246 entries in 14,786 ms of JSON-RPC time; the correction calls took 439 ms and 455 ms. There were **zero rejected patches, zero curated skips and zero `docsUnverified` results**.

Every entry has an original plain description of at most 140 characters, a concise capability, an official documentation link and one to four lowercase tags. Non-service kinds distinguish storage, messaging, physical devices and external support offerings. Different icon variants for the same product intentionally share metadata. Historical names remain as search aliases for renamed products.

Sources were discovered through the [AWS documentation directory](https://docs.aws.amazon.com/), its [official guide index](https://docs.aws.amazon.com/llms.txt), the [AWS SDK service index](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/class_list.html), and direct official documentation searches. All 246 selected source URLs were fetched and returned HTTP 200; none silently redirected to the documentation home page. The AWS-maintained OpenTelemetry, Neuron and EKS Anywhere documentation sites are used for those products. Elemental Link uses AWS's official quick-start PDF. Professional Services and Training use the official product pages linked by the documentation directory, because they are offerings rather than API services.

Product identity and availability were checked separately. Renames include AppStream → WorkSpaces Applications, Chatbot → Amazon Q Developer in chat applications, Elasticsearch Service → OpenSearch Service, and NICE DCV → Amazon DCV. The old DeepRacer guide redirects to the current DeepRacer on AWS solution; its label and URL now follow that destination. Amazon Chime is explicitly described as retired. Historical services retain product-specific archived SDK references where current guides are unavailable; those links document the service, not its current availability. The [maintenance](https://docs.aws.amazon.com/general/latest/gr/maintenance_services.html), [sunset](https://docs.aws.amazon.com/general/latest/gr/sunset_services.html) and [full shutdown](https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html) lists informed the legacy wording. The review correction explicitly dates the announced end of support for App Mesh (September 30, 2026), FinSpace, Lookout for Equipment, Fraud Detector and Proton (October 7, 2026), and Pinpoint (October 30, 2026). Pinpoint API wording distinguishes retiring engagement APIs from continuing AWS End User Messaging channels. A metadata description is not a recommendation to adopt a sunset service.

## Twenty-link sample

Checked on 2026-09-29. Each page was fetched, its subject inspected and its final destination recorded. HTTP success alone was not used to infer the product identity.

| Icon slug                 | Product / documentation                                                                                               | Result                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `glue`                    | [AWS Glue](https://docs.aws.amazon.com/glue/)                                                                         | 200; product subject verified |
| `ec2`                     | [Amazon Elastic Compute Cloud](https://docs.aws.amazon.com/ec2/)                                                      | 200; product subject verified |
| `lambda`                  | [AWS Lambda](https://docs.aws.amazon.com/lambda/)                                                                     | 200; product subject verified |
| `simple-storage-service`  | [Amazon Simple Storage Service](https://docs.aws.amazon.com/s3/)                                                      | 200; product subject verified |
| `dynamodb`                | [Amazon DynamoDB](https://docs.aws.amazon.com/dynamodb/)                                                              | 200; product subject verified |
| `aurora`                  | [Amazon Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html)                | 200; product subject verified |
| `api-gateway`             | [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/)                                                         | 200; product subject verified |
| `appstream`               | [Amazon WorkSpaces Applications](https://docs.aws.amazon.com/appstream2/latest/developerguide/what-is-appstream.html) | 200; product subject verified |
| `chatbot`                 | [Amazon Q Developer in chat applications](https://docs.aws.amazon.com/chatbot/)                                       | 200; product subject verified |
| `elasticsearch-service`   | [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/)                                          | 200; product subject verified |
| `quicksight`              | [Amazon Quick](https://docs.aws.amazon.com/quick/)                                                                    | 200; product subject verified |
| `kinesis-firehose`        | [Amazon Data Firehose](https://docs.aws.amazon.com/firehose/)                                                         | 200; product subject verified |
| `resource-access-manager` | [AWS Resource Access Manager](https://docs.aws.amazon.com/ram/latest/userguide/what-is.html)                          | 200; product subject verified |
| `neuron`                  | [AWS Neuron](https://awsdocs-neuron.readthedocs-hosted.com/en/latest/about-neuron/what-is-neuron.html)                | 200; product subject verified |
| `eks-anywhere`            | [Amazon EKS Anywhere](https://anywhere.eks.amazonaws.com/docs/overview/)                                              | 200; product subject verified |
| `backint-agent`           | [AWS Backint Agent for SAP HANA](https://docs.aws.amazon.com/sap/latest/sap-hana/aws-backint-agent-sap-hana.html)     | 200; product subject verified |
| `sagemaker-ground-truth`  | [Amazon SageMaker Ground Truth](https://docs.aws.amazon.com/sagemaker/latest/dg/sms.html)                             | 200; product subject verified |
| `workdocs`                | [Amazon WorkDocs](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/WorkDocs.html)                              | 200; product subject verified |
| `chime`                   | [Amazon Chime](https://docs.aws.amazon.com/chime/)                                                                    | 200; product subject verified |
| `deepracer`               | [DeepRacer on AWS](https://docs.aws.amazon.com/solutions/latest/deepracer-on-aws/solution-overview.html)              | 200; product subject verified |

## Remaining 27

`aws` is the AWS brand mark, not an individual product. The other 26 are deferred documentation mappings, **not generic glyphs**. Their labels identify products or projects, but this bounded fill did not establish a sufficiently reviewed product-specific documentation choice for them. They remain visibly incomplete rather than receiving a guessed URL or a generic vendor homepage:

`activate`, `alexa-for-business`, `bottlerocket`, `cloudendure-disaster-recovery`, `cloudendure-migration`, `codestar`, `deepcomposer`, `deeplens`, `elemental-delta`, `glue-elastic-views`, `honeycode`, `iot-button`, `iq`, `migration-evaluator`, `rds-on-vmware`, `snowcone`, `snowmobile`, `sumerian`, `thinkbox-deadline`, `thinkbox-frost`, `thinkbox-krakatoa`, `thinkbox-sequoia`, `thinkbox-stoke`, `thinkbox-xmesh`, `torchserve`, `vmware-cloud-on-aws`.

Several are discontinued offerings (including CodeStar, DeepComposer, DeepLens, IQ, RDS on VMware, Snowmobile and Sumerian); others, such as Bottlerocket, Activate, Migration Evaluator and TorchServe, need separate documentation mapping. No existing curated entry was overwritten. There are no unidentified labels claimed as filled products.

## Verification

- Actual MCP prompt, pagination, writes, follow-up reads and missing count recorded; all 246 entries complete, 27 remaining, zero unverified documentation flags.
- Server `readAll` response: 273 AWS icons, 246 complete metadata entries, zero catalog problems. Every merged name, docs URL and capability agrees with the YAML; all descriptions, tag counts and curation flags satisfy the fill contract.
- Fifty-six entry-page browser cases: fourteen representative products × light/dark × 1440/390. Names, descriptions, docs links, unchecked badges and keyboard link focus pass; no horizontal overflow, browser errors or document writes. Sources remain unchanged by browsing.
- Catalog Prettier check passes. Only `catalog/aws.yaml` and this findings document are changed; application code, other vendors, parts and dependencies are untouched.

Detailed source responses, per-URL status/final URL/title, MCP call payloads and timings, screenshots and test output are retained in the ignored catalog-fill evidence. Reachability was verified at the time of this pass; it does not certify future URL availability or service support.
