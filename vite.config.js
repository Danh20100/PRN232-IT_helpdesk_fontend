import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: gọi /api sẽ được chuyển tới backend (dotnet run / docker) ở cổng 8080
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } }
});
