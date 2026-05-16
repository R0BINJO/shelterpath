import { Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function Home() {
  return <ScreenContent />;
}

function ScreenContent() {
  return (
    <View className="flex basis-full flex-col bg-background p-8">
      <Stack.Screen
        options={{
          title: 'Home',
        }}
      />
      <View className="flex-1 items-center justify-center">
        <Text className="mb-4 text-center text-2xl font-bold">Welcome to Your App</Text>
        <Text className="text-center text-base text-muted-foreground">
          This is your starting point. Start building something amazing!
        </Text>
      </View>
    </View>
  );
}
