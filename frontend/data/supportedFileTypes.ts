export const supportedNonTextualFileTypes: string[] = [
    "image/jpg", 
    "image/jpeg", 
    "image/bmp", 
    "image/gif", 
    "image/png", 
    "image/x-icon", 
    
    "application/pdf", 

    "video/mp4",
    "video/webm",

    "audio/ogg",
    "audio/mpeg",
    "audio/wav",
    "audio/flac",
    "audio/x-m4a",
    "audio/vnd.dlna.adts", // aac with ADTS encapsulation
    "audio/x-ms-wma", // wma

    // There are a lot of text file types which would be supported, so for efficiency check startsWith in the function below instead
]

export function isFileTypeSupported(fileType: string): boolean {
    return supportedNonTextualFileTypes.includes(fileType) || fileType.startsWith("text/");
}


/* Tested but unsupported types (to test a type, put it in the above array first):

video/quicktime (mov) - viewing didn't seem to work in multiple tested browsers, may have to do with CloudFlare r2 presigned urls not displaying .mov content in browser for some reason, maybe due to browsers not supporting it)
video/MP2T (ts) - this type can include audio AND video

audio/vnd.dolby.dd-raw (ac3)
audio/aiff

*/