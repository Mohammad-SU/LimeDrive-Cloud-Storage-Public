export interface FileType {
    id: number
    name: string
    appPath: string
    type: string
    size: number
    mediaDuration?: number
    created_at: Date
    parentFolderId: string | null // d_ prefix if not in root, null if in root
}