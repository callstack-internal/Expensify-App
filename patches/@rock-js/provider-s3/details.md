# `@rock-js/provider-s3` patches

### [@rock-js+provider-s3+0.11.9+001+support-public-access.patch](@rock-js+provider-s3+0.11.9+001+support-public-access.patch)

- Reason:

    ```
    This patch adds support for accessing public S3 buckets without authentication. 
    When the `publicAccess` option is set to true, the provider will not sign requests and will attempt to access the S3 bucket without AWS credentials. This is useful for scenarios where the S3 bucket is configured for public read access.
    ```

- Upstream PR/issue: https://github.com/callstackincubator/rock/pull/625
- E/App issue: https://github.com/Expensify/App/issues/74400
- PR introducing patch: https://github.com/Expensify/App/pull/73525