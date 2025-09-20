import admin from "firebase-admin"
import {createRequire} from "module"

const require = createRequire(import.meta.url)
const serviceAccount = require("../../firebaseAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
})

export default admin