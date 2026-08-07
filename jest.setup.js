// AsyncStorage has no implementation under Jest; the package ships an official
// in-memory mock for exactly this.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
