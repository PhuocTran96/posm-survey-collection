/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./public/**/*.js",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors matching the existing admin theme
        'admin-primary': '#667eea',
        'admin-secondary': '#764ba2',
      }
    },
  },
  plugins: [],
  // Enable JIT mode for better performance
  mode: 'jit',
}