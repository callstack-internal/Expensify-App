# `@rock-js/provider-s3` patches

### [@rock-js+provider-s3+0.11.9+001+support-public-bucket-access.patch](@rock-js+provider-s3+0.11.9+001+support-public-bucket-access.patch)

- Reason:

    ```
    This patch adds support for public S3 bucket access when no credentials are provided. 
    The library originally required credentials for all S3 operations, but we need to support 
    public buckets that don't require authentication to allow all contributors to use remote cached builds. The patch 
    adds an else clause that configures a no-op signer and empty credentials when no access 
    keys, role ARN, or profile is provided.
    ```

- Upstream PR/issue: 🛑 TODO 
- E/App issue: https://github.com/Expensify/App/issues/62296
- PR introducing patch: https://github.com/Expensify/App/pull/73525

### [@rock-js+provider-s3+0.11.9+002+add acl param.patch](@rock-js+provider-s3+0.11.9+002+add%20acl%20param.patch)

- Reason:

    ```
    This patch adds support for setting ACL (Access Control List) when uploading artifacts to S3.
    Without this patch, uploaded artifacts don't have public-read ACL set, which causes AccessDenied 
    errors when trying to download them without authentication. This allows artifacts to be publicly accessible for download.
    ```

- Upstream PR/issue: 🛑 TODO 
- E/App issue: 🛑 TODO
- PR introducing patch: 🛑 TODO

### 