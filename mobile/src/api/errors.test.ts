import { errorMessage } from '@/api/errors';

describe('an error message', () => {
  it('passes the app\'s own message through', () => {
    expect(errorMessage('找不到這天排定的動作', 404)).toBe('找不到這天排定的動作');
  });

  it('names the field a validation error is about, in Chinese', () => {
    const email = [{ loc: ['body', 'email'], msg: 'value is not a valid email address: The part after the @-sign is a special-use or reserved name' }];
    expect(errorMessage(email, 422)).toBe('Email 格式不正確，請確認有沒有打錯。');
    expect(errorMessage([{ loc: ['body', 'items', 0, 'reps'], msg: "String should match pattern '^\\d+'" }], 422)).toBe('次數的格式不正確。');
  });

  it('keeps a check written in Chinese, without pydantic\'s prefix', () => {
    expect(errorMessage([{ loc: ['body'], msg: 'Value error, 動作需要次數或時間，但不能同時提供' }], 422)).toBe(
      '動作需要次數或時間，但不能同時提供',
    );
  });

  it('falls back to something general', () => {
    expect(errorMessage([{ loc: ['body', 'mystery'], msg: 'Input should be valid' }], 422)).toBe('輸入的資料格式不正確，請檢查後再試。');
    expect(errorMessage(null, 500)).toBe('請求失敗（500）');
  });
});
