export interface QueueFileType {
    fileObj: File, // This is JS "File", not the "FileType" from the types folder here
    id: number | null;
    appPath: string;
}