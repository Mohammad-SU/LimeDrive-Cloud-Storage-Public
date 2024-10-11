export interface FolderType {
    id: string; // d_ prefix are added to their frontend ids ('d' standing for directory) to help avoid conflicts and confusion with file id's
    name: string;
    appPath: string;
    type?: undefined;
    created_at: Date;
    parentFolderId: string | null // d_ prefix if not in root, null if in root
}