# Dedicated GitHub OIDC role for read-only EC2 SSM diagnostics

This setup is separate from `TradeMateEC2SSMRole` and from the existing staging deployment/migration role. Do not add `ssm:SendCommand` to either of those roles.

## 1. Create the IAM role

In AWS account `661406600284`, region `eu-north-1`, create an IAM role named:

`TradeMateSSMReadOnlyDiagnosticsRole`

Trusted entity: Web identity. Require approval by a trusted reviewer for jobs using the `aws-ssm-diagnostics` GitHub environment; restrict deployment branches to `main` and prevent self-review where supported.

- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- GitHub organization/user: `Iamgetty`
- Repository: `TradeMate`
- GitHub environment: `aws-ssm-diagnostics`

Use this trust policy (the GitHub OIDC provider must already exist in the account):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TrustOnlyTradeMateSSMDiagnosticsEnvironment",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::661406600284:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:Iamgetty/TradeMate:environment:aws-ssm-diagnostics"
        }
      }
    }
  ]
}
```

Do not reuse `AWS_STAGING_DEPLOY_ROLE_ARN`: the existing staging OIDC workflows use a different GitHub environment and that role is intended for staging deployment/migration operations.

## 2. Create the fixed SSM command document

In Systems Manager → Documents, create a document named `TradeMate-ReadOnly-EC2-Diagnostics`, document type **Command**, using the exact contents of [the checked-in document definition](./ssm-documents/TradeMate-ReadOnly-EC2-Diagnostics.yml).

This custom document contains the read-only diagnostic commands and accepts no parameters. Do not grant this GitHub role permission to create or update SSM documents. Only an administrator should update the document after review.

## 3. Attach this least-privilege inline permissions policy

Policy name: `TradeMateSSMReadOnlyCommandExecution`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendRunShellScriptToOnlyTradeMateStagingInstance",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:eu-north-1:661406600284:document/TradeMate-ReadOnly-EC2-Diagnostics",
        "arn:aws:ec2:eu-north-1:661406600284:instance/i-035b1f1d00052c77e"
      ]
    },
    {
      "Sid": "ReadCommandInvocationOutput",
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

AWS does not list a resource type for `ssm:GetCommandInvocation`, so that read action uses `Resource: "*"`. The command-submission action is constrained to the single account-owned, parameter-free diagnostic document and the one EC2 instance. No `ssm:StartSession`, `ssm:CancelCommand`, IAM, EC2 write, or infrastructure permissions are included.

## 4. Add the GitHub environment variable

In GitHub repository settings, create environment `aws-ssm-diagnostics` (if it does not exist), then add this **environment variable** (not a secret):

- Name: `AWS_SSM_DIAGNOSTICS_ROLE_ARN`
- Value: `arn:aws:iam::661406600284:role/TradeMateSSMReadOnlyDiagnosticsRole`

The workflow uses GitHub OIDC; no AWS access keys or long-lived credentials are needed.

## 5. Run the workflow

After the role and variable exist, open:

`https://github.com/Iamgetty/TradeMate/actions/workflows/aws-ec2-ssm-remote-read-only-diagnostics.yml`

Choose **Run workflow**. It runs the fixed, parameter-free custom SSM document against only `i-035b1f1d00052c77e`. The role cannot send AWS-RunShellScript or arbitrary shell commands; it can invoke only this reviewed document on the one instance. The document accepts no parameters and performs read-only checks. The workflow does not install/change anything.

Keep the existing Render services and database untouched. This diagnostic workflow does not perform a migration or cutover.
