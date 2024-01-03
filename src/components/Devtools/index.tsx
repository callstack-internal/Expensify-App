import {Pressable, Text} from 'react-native';
import Performance from 'react-native-performance';

const onPress = () => {
    console.log('Devtools collecting performance metrics...');
    fetch('http://localhost:8080', {
        method: 'POST',
        headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
        body: JSON.stringify(Performance.getEntries()),
    });
};

function Devtools() {
    return (
        <Pressable
            onPress={onPress}
            style={{backgroundColor: 'black', position: 'absolute', bottom: 0, zIndex: 1000, width: '100%'}}
        >
            <Text>Send data</Text>
        </Pressable>
    );
}

export default Devtools;
