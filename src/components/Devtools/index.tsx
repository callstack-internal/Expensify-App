import {Pressable, Text} from 'react-native';
import Performance from 'react-native-performance';

const onPress = async () => {
    console.log('Devtools collecting performance metrics...');
    // TODO: switch for your local IP
    try {
        await fetch('http://192.168.0.106:8080', {
            method: 'POST',
            headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
            body: JSON.stringify(Performance.getEntries()),
        });
    } catch (e) {
        console.log('Error', e);
    }
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
