import type { Config } from 'tailwindcss';

/**
 * 業務システム向け設定。装飾より情報密度を優先するため、
 * 既定フォントサイズを小さめに、行間を詰めている。
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 優先度カラー (§45)。色だけに依存せずアイコン/テキストも併記する。
        normal: { bg: '#f4f5f7', fg: '#3f4451', line: '#d8dbe2' },
        warn: { bg: '#fff8e1', fg: '#8a6100', line: '#f2d98a' },
        late: { bg: '#fff1e6', fg: '#9a4a06', line: '#f5c199' },
        crit: { bg: '#fdecec', fg: '#a01212', line: '#f3aeae' },
        done: { bg: '#e9f7ef', fg: '#0f6b3d', line: '#a7ddbf' },
      },
      fontSize: {
        xxs: ['11px', '15px'],
        xs: ['12px', '17px'],
        sm: ['13px', '19px'],
        base: ['14px', '21px'],
      },
    },
  },
  plugins: [],
};
export default config;
