const store = {};

exports.store = (key, value) => store[key] = value;

exports.get = key => store[key] || null;

exports.handleRemoteTranscodeRequest = json => {
    console.log(json);
};
