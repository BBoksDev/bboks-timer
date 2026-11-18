# 뽁타이머 (BBoks Timer)

타바타·HIIT·서킷용 인터벌 운동 타이머. Expo(React Native)로 만든 안드로이드·iOS 공용 앱입니다.

## 기능
- 준비 / 운동 / 휴식 / 사이클 휴식 / 정리 구간, 라운드·사이클 반복
- 운동 프리셋 만들기·편집·복제·삭제 (기기에 저장)
- 큰 숫자 타이머, 구간별 색상, 가로 모드
- 비프음·한국어 음성 안내·진동, 마지막 N초 카운트다운
- 화면 꺼짐 방지, 앱을 나가도 구간 전환을 알림으로 알려줌
- 운동 기록(일지): 이번 주 횟수·시간, 연속 운동일

## 폰에서 써보기 (개발용)
1. 컴퓨터에 Node.js 설치 후 이 폴더에서 `npm install`
2. `npx expo start` 실행
3. 아이폰/안드로이드에 **Expo Go** 앱을 설치하고 터미널의 QR 코드를 스캔

## 스토어 배포 (EAS)
```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios      # App Store Connect
npx eas-cli@latest submit --platform android  # Google Play
```
- iOS: Apple Developer Program(연 $99) 필요. 맥 없이 EAS 클라우드에서 빌드됩니다.
- Android: Google Play 개발자 계정(1회 $25) 필요.
- 번들 ID: `com.bboks.timer` (app.json에서 변경 가능)

## 구조
- `App.tsx` 화면 전환·탭바
- `src/model.ts` 데이터 타입, 구간 계획(buildPlan)
- `src/store.tsx` 저장(AsyncStorage)
- `src/feedback.ts` 소리·음성·진동·백그라운드 알림
- `src/screens/` 운동 목록, 편집, 타이머, 기록, 설정
