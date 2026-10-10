// Two Firebase projects: handoff-dev for testing, handoff-prod for real
// students at handoffsublease.com. `npm run build:prod` (and deploy:prod)
// builds for prod; everything else uses dev. Web configs are not secrets:
// they ship in every Firebase web app, and the rules files do the protecting.
export const DEV = {
  apiKey: 'AIzaSyBomTmhpE6oxU5IJwxB29XCbxP8xX6wfDk',
  authDomain: 'handoff-dev-e63cc.firebaseapp.com',
  projectId: 'handoff-dev-e63cc',
  storageBucket: 'handoff-dev-e63cc.firebasestorage.app',
  messagingSenderId: '319974667369',
  appId: '1:319974667369:web:a643fa69d29cfa4dac9ef8',
  measurementId: 'G-P6K8KV93PM',
}

// handoff-prod: real students at handoffsublease.com.
export const PROD = {
  apiKey: 'AIzaSyBRo-Vi0uUr_vnoAh3C5bLJ8YQeowN_2UA',
  authDomain: 'handoff-prod-50bc0.firebaseapp.com',
  projectId: 'handoff-prod-50bc0',
  storageBucket: 'handoff-prod-50bc0.firebasestorage.app',
  messagingSenderId: '736247325886',
  appId: '1:736247325886:web:8a03776ace8adae36aaaef',
  measurementId: 'G-XKEQ0RSCFJ',
}
