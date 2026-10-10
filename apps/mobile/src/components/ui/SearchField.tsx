import { Pressable, View } from 'react-native';

import { CloseIcon, SearchIcon } from './icons';
import { TextField } from './TextField';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Read by screen readers, e.g. "Search activities". */
  label: string;
}

/** A text field with a magnifier and a clear button. */
export function SearchField({ value, onChangeText, placeholder, label }: SearchFieldProps) {
  return (
    <View className="justify-center">
      <TextField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={label}
        size="md"
        autoCorrect={false}
        returnKeyType="search"
        className="pl-11 pr-11"
      />
      <View className="absolute left-4" pointerEvents="none">
        <SearchIcon />
      </View>
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          className="absolute right-3 h-7 w-7 items-center justify-center rounded-full bg-surface active:opacity-70"
        >
          <CloseIcon size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
