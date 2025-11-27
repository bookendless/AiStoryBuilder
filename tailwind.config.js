/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'noto-jp': ['Noto Sans JP', 'sans-serif'],
      },
      colors: {
        // 日本の伝統色を取り入れたカラーパレット
        // 卯の花色（うのはないろ）- メイン背景
        unohana: {
          50: '#F7FCFE',
          100: '#EFF9FD',
          200: '#DFF3FB',
          300: '#CFEDF9',
          400: '#BFE7F7',
          500: '#AFE1F5',
          600: '#8CB4C4',
          700: '#698793',
          800: '#465A62',
          900: '#232D31',
        },
        // 藍色（あいいろ）- プライマリアクセント
        ai: {
          50: '#E8EDF5',
          100: '#D1DBEB',
          200: '#BAC9E1',
          300: '#A3B7D7',
          400: '#8CA5CD',
          500: '#4A6FA5',
          600: '#3D5A8A',
          700: '#30456F',
          800: '#233054',
          900: '#161B39',
        },
        // 水色（みずいろ）- セカンダリアクセント
        mizu: {
          50: '#E8F2F7',
          100: '#D1E5EF',
          200: '#BAD8E7',
          300: '#B8D4E3',
          400: '#A8C4D3',
          500: '#98B4C3',
          600: '#7A90A0',
          700: '#5C6C7D',
          800: '#3E485A',
          900: '#202437',
        },
        // 薄墨（うすずみ）- ボーダー・区切り
        usuzumi: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D4D4D4',
          300: '#9E9E9E',
          400: '#7A7A7A',
          500: '#5C5C5C',
          600: '#4A4A4A',
          700: '#383838',
          800: '#262626',
          900: '#141414',
        },
        // 墨色（すみいろ）- テキスト
        sumi: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D4D4D4',
          300: '#9E9E9E',
          400: '#6B6B6B',
          500: '#4A4A4A',
          600: '#3A3A3A',
          700: '#2C2C2C',
          800: '#1E1E1E',
          900: '#101010',
        },
        // 桜色（さくらいろ）- 成功・完了状態
        sakura: {
          50: '#FFF0F1',
          100: '#FFE1E3',
          200: '#FEDFE1',
          300: '#FCC5C9',
          400: '#FAABB1',
          500: '#F89199',
          600: '#C6747A',
          700: '#94575C',
          800: '#623A3D',
          900: '#301D1F',
        },
        // 若草色（わかくさいろ）- 進行中・成長
        wakagusa: {
          50: '#F0F8EB',
          100: '#E1F1D7',
          200: '#C8E4B2',
          300: '#B5D99C',
          400: '#A2CE86',
          500: '#8FC370',
          600: '#729C5A',
          700: '#557544',
          800: '#384E2E',
          900: '#1B2717',
        },
        // 山吹色（やまぶきいろ）- 警告・注意喚起
        yamabuki: {
          50: '#FFF8E8',
          100: '#FFF1D1',
          200: '#FFEABA',
          300: '#FFE3A3',
          400: '#FFDC8C',
          500: '#F8B500',
          600: '#C69000',
          700: '#946B00',
          800: '#624600',
          900: '#302300',
        },
        // 後方互換性のため、既存の色も保持
        indigo: {
          50: '#E8EDF5',
          100: '#D1DBEB',
          200: '#BAC9E1',
          300: '#A3B7D7',
          400: '#8CA5CD',
          500: '#4A6FA5',
          600: '#3D5A8A',
          700: '#30456F',
          800: '#233054',
          900: '#161B39',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
};