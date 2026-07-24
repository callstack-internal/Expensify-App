/**
 * Copies a picked file's bytes into a memory-backed File. A picked File only references its OS
 * file, so if that file is modified or deleted before the queued request is persisted, the
 * IndexedDB write fails with "Failed to write blobs" and poisons the persisted request queue.
 * Rejects when the backing file is already unreadable.
 */
async function snapshotPickedFile(file: File, name: string): Promise<File> {
    return new File([await file.arrayBuffer()], name, {type: file.type, lastModified: file.lastModified});
}

export default snapshotPickedFile;
