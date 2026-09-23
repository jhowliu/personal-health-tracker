/** 設計 tokens 取自規格書,顏色與圓角只在這裡定義一次。 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // App 只有亮色(app.json 的 userInterfaceStyle: light),
  // 用 class 模式才不會跟系統深色模式打架。
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#1F1B1D',
        muted: '#5E585B',
        line: '#D9D3CB',
        fill: '#EFEBE5',
        bg: '#FBFAF7',
        surface: '#FFFFFF',
        primary: { DEFAULT: '#A3245F', soft: '#F6E3EC' },
        good: { DEFAULT: '#2F6B4C', soft: '#E2F0E7' },
        warm: { DEFAULT: '#8A5A0B', soft: '#F6EBD3' },
      },
      fontFamily: {
        display: ['LXGW WenKai TC'],
        body: ['Noto Sans TC'],
      },
      borderRadius: {
        field: '10px',
        card: '14px',
        sheet: '16px',
      },
    },
  },
  plugins: [],
};
