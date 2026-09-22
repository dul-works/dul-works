/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans', 'sans-serif'],
        display: ['Abhaya Libre', 'serif'],
      },
      maxWidth: {
        'container': '1440px',
      },
    },
  },
  plugins: [],
}

