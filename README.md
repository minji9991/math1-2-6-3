# Vercel + Supabase 연습용: 다각형의 대각선 웹활동지

## 들어 있는 것
- 학생 학번 입력 및 접속 시각 저장
- 사각형/오각형/육각형에서 A 한 꼭짓점 대각선 직접 그리기
- `n-3` 일반화 입력
- `AC`와 `CA`가 같은 대각선인지 O/X
- 오각형에서 방향을 붙인 대각선 10개 그리기
- 반대 방향끼리 5쌍으로 짝짓기
- 전체 대각선 공식 `n(n-3)/2` 일반화
- 탭/앱 이탈 시 `page_hidden`, 복귀 시 `page_visible` 이벤트 저장
- 교사용 `teacher.html`에서 접속 시각/마지막 기록/이탈 횟수/제출 시각 확인

> 브라우저에서 알 수 있는 것은 '이 페이지가 보였는가/숨겨졌는가'뿐입니다. 학생이 어떤 다른 앱이나 사이트를 열었는지는 알 수 없습니다.

## 1. Supabase 만들기
1. https://supabase.com 에서 새 프로젝트 생성
2. SQL Editor에서 `supabase.sql` 전체 실행
3. Project Settings > API에서 Project URL, anon public key 복사
4. `supabase-config.js`의 두 값을 교체

## 2. 교사 계정 만들기
1. Supabase > Authentication > Users > Add user
2. 교사 이메일/비밀번호 계정 생성
3. 생성된 User UUID 복사
4. SQL Editor에서 아래 실행

```sql
insert into public.teacher_profiles(user_id, display_name)
values ('여기에_USER_UUID', '교사');
```

## 3. 로컬에서 확인
보안상 `file://`로 직접 열지 말고 간단한 로컬 서버를 띄우세요.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

## 4. Vercel 배포
가장 쉬운 방법:
1. 이 폴더를 GitHub 저장소에 업로드
2. https://vercel.com 로그인
3. Add New > Project
4. GitHub 저장소 선택
5. Framework Preset은 `Other`
6. Build Command 비워 둠, Output Directory 비워 둠
7. Deploy

학생 주소: `https://프로젝트명.vercel.app/`
교사 주소: `https://프로젝트명.vercel.app/teacher.html`

## 꼭 알아둘 점
- 현재 버전은 **연습용 MVP**입니다.
- 학생은 Supabase Auth로 로그인하지 않고 학번만 입력합니다. 그래서 개인정보/성적처럼 민감한 데이터를 저장하는 실제 운영판에서는 인증 구조를 더 강화하는 편이 안전합니다.
- `anon key`는 브라우저에 들어가도 되는 공개 키입니다. 대신 **RLS 정책이 보안을 결정**하므로 service role key는 절대로 웹페이지에 넣지 마세요.
- 학교 사용 전에는 학교/교육청의 개인정보 처리 기준에 맞게 학번 저장 범위와 보관 기간을 정하세요.
