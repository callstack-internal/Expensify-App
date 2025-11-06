# `rock` patches

### [rock+0.11.9+001+temporary-test-logs.patch](rock+0.11.9+001+temporary-test-logs.patch)

- Reason:

    ```
    This patch adds temporary debug logging to help troubleshoot remote cache upload and download 
    operations. It logs artifact names, local artifact paths, binary paths, and upload/download 
    flow details to track the execution path and identify issues with artifact handling, 
    particularly when uploading builds that haven't been downloaded first (where the local cache 
    directory doesn't exist yet).
    ```

- Upstream PR/issue: 🛑 TODO 
- E/App issue: N/A (temporary debugging patch)
- PR introducing patch: 🛑 TODO

