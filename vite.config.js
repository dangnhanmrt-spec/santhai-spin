import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Tắt sourcemap → người ngoài không đọc được code gốc
    sourcemap: false,
    // Minify mạnh nhất
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,   // Xóa console.log trong production
        drop_debugger: true,  // Xóa debugger
      },
      mangle: {
        toplevel: true,       // Đổi tên biến top-level
      },
    },
  },
});
