/** Design tokens from docs/design/health-journal-ui-guideline.md; colours and radii live only here. */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // App 只有亮色(app.json 的 userInterfaceStyle: light),
  // 用 class 模式才不會跟系統深色模式打架。
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#30302E',
        muted: '#514E49',
        placeholder: '#625E58',
        disabled: '#776D65',
        // The dark outline of cards, buttons and inputs.
        edge: '#3E3A39',
        line: '#E7DFD5',
        fill: '#F3EDE4',
        bg: '#FFFCF6',
        surface: '#FFFFFF',
        primary: { DEFAULT: '#A32B64', soft: '#F6E3EC' },
        good: { DEFAULT: '#30694D', soft: '#E3EFD9' },
        warm: { DEFAULT: '#89580E', soft: '#FFF2D7', fill: '#B17B23' },
        purple: { DEFAULT: '#7450A5', soft: '#EEE5F8' },
        // Destructive actions such as deleting an account or a meal. Warnings use `warm`.
        danger: '#B42318',
        // The dimmed backdrop behind a bottom sheet.
        scrim: 'rgba(35, 31, 32, 0.35)',
      },
      borderRadius: {
        field: '10px',
        // A small outlined button; the main berry button is `button`.
        control: '11px',
        button: '13px',
        // A meal or workout template card in a list.
        tile: '19px',
        // A container holding a list of rows.
        card: '21px',
        sheet: '21px',
      },
    },
  },
  plugins: [],
};
