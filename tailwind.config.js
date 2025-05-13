/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#fdf4f9',
          100: '#f4cbe1',
          200: '#f1b8d7',
          300: '#eda5cd',
          400: '#ea92c3',
          500: '#e77fb9',
          600: '#e46caf',
          700: '#e159a5',
          800: '#de469b',
          900: '#db3391',
        },
      },
    },
  },
  plugins: [],
};