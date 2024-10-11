self.addEventListener('message', async (event) => {
    const { url } = event.data;
    const decoder = new TextDecoder();
  
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            self.postMessage({
                type: 'chunk',
                chunk,
            });
        }

        self.postMessage({ type: 'done' });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
});