/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vinno: {
          primary: '#1A2A4F',   // Text
          box1: '#F7A5A5',      // Info Boxes
          box2: '#FFDBB6',      // Table & Upload
          bg: '#FFF2EF',        // Background
          white: '#FFFFFF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], 
      }
    },
  },
  plugins: [],
}