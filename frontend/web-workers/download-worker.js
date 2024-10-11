importScripts('https://unpkg.com/client-zip@2.4.5/worker.js');
importScripts('https://unpkg.com/dl-stream@1.0.2/worker.js');

self.addEventListener('message', async (event) => {
	const { foldersToZip, filesToZip } = event.data;

	try {
		const folderObjects = foldersToZip
			.map((resFolder) => ({ name: resFolder.zipPath + '/' }));

		const fileUrls = filesToZip
			.map((resFile) => new Request(resFile.url));

		const downloadStream = new DownloadStream(fileUrls);

		// For lazy fetching file objects for downloadZip once needed instead of waiting 
		// for all file objects to be retrieved (so less wait time for download to start)
		async function* fileObjectGenerator() {
			yield* folderObjects;

			let index = 0;
			for await (const response of downloadStream) {
				if (!response) {
					throw new Error("Unexpected end of stream");
				}
				yield {
					name: filesToZip[index].zipPath,
					input: response.body
				};
				index++;
			}
		}

		// NOTE: CORS error may occur during local dev for specific media files occasionally (such as Summer.mp3 and Bonfire.mp4) 
		// But this doesn't seem to occur at all in prod, even for huge files.

		const zipStream = downloadZip(fileObjectGenerator()).body; // Slower if dev tools are open at the same time

        const reader = zipStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            self.postMessage({ chunk: value }, [value.buffer]);
        }

        self.postMessage({ done: true });
	} 
	catch (error) {
		self.postMessage({ error: error.message });
	}
});