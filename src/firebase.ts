import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDNKoG_U3E6dcB5omNpAImBrWS8RNeUYF0',
  authDomain: 'mashro3y-e9c13.firebaseapp.com',
  projectId: 'mashro3y-e9c13',
  storageBucket: 'mashro3y-e9c13.firebasestorage.app',
  messagingSenderId: '1079077984647',
  appId: '1:1079077984647:web:e740c0720e1325ca2cdb22',
};

// تهيئة فايربيز
const app = initializeApp(firebaseConfig);

// تفعيل الكاش الدائم في المتصفح (IndexedDB) للعمل بدون إنترنت والتحميل الفوري ورفع التحديثات تلقائياً عند عودة الإنترنت
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
