import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, Empty, Screen, Segmented, Title } from '@/components/ui';

type Tab = 'mine' | 'library';

export default function MealsScreen() {
  const [tab, setTab] = useState<Tab>('mine');
  const [category, setCategory] = useState('all');

  return (
    <Screen>
      <Title>餐點</Title>

      <Segmented
        value={tab}
        onChange={setTab}
        tone="soft"
        options={[
          { value: 'mine', label: '我的餐點' },
          { value: 'library', label: '食物庫' },
        ]}
      />

      <View className="flex-row flex-wrap gap-2">
        {(tab === 'mine'
          ? [
              { id: 'all', label: '全部' },
              { id: 'breakfast', label: '早餐' },
              { id: 'lunch', label: '午餐' },
              { id: 'dinner', label: '晚餐' },
            ]
          : [
              { id: 'all', label: '全部' },
              { id: 'staple', label: '主食' },
              { id: 'protein', label: '蛋白質' },
              { id: 'vegetable', label: '蔬菜' },
              { id: 'fruit', label: '水果' },
              { id: 'fat_sauce', label: '油脂與醬料' },
            ]
        ).map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={category === option.id}
            onPress={() => setCategory(option.id)}
          />
        ))}
      </View>

      <Card className="gap-2">
        <Text className="text-base font-semibold text-ink">第二階段開發</Text>
        <Text className="text-base text-muted">
          食物庫、自建餐點、等量替換與每日自動分配屬於 P2。畫面骨架、分類與共用的 FoodOptionRow
          已經備好,接上 /foods 與 /meals 就能填內容。
        </Text>
      </Card>

      <Empty>{tab === 'mine' ? '還沒有自己的餐點' : '食物庫還沒有匯入資料'}</Empty>
    </Screen>
  );
}
