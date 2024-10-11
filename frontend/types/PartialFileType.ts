import { FileType } from "."

export type PartialFileType = Pick<FileType, 'id' | 'name' | 'type' | 'size'>; // For link-share view