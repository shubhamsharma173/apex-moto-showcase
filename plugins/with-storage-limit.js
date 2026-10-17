const { withGradleProperties } = require("expo/config-plugins");
module.exports = function withStorageLimit(config) {
  return withGradleProperties(config, (config) => {
    const key = "AsyncStorage_db_size_in_MB";
    config.modResults = config.modResults.filter(
      (p) => !(p.type === "property" && p.key === key),
    );
    config.modResults.push({ type: "property", key, value: "256" });
    return config;
  });
};
