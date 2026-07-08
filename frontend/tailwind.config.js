
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gob: {
          guinda: '#9D2148',
          dorado: '#B28E5C',
          blanco: '#FFFFFF',
          marfil: '#FFFAE9',
          gris: '#55585A',
          negro: '#000000',
        },
        bg: '#f9fafb',
        surface: '#ffffff',
        primary: {
          DEFAULT: '#9D2148',
          hover: '#7a1a38',
          dark: '#3b1424',
          light: '#f7ebef',
        },
        accent: {
          DEFAULT: '#B28E5C',
          hover: '#9c7b4f',
        },
        dark: {
          DEFAULT: '#55585A',
          surface: '#3b3d3e',
        },
        text: {
          DEFAULT: '#000000',
          light: '#55585A',
          white: '#ffffff',
        },
        border: '#e2e8f0',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.1)',
        md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      }
    },
  },
  plugins: [],
}
