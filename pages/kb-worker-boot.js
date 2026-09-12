/**
 * 서버 크롬(대신 읽기)의 시작 페이지 — 확장의 배경 스크립트가 이 탭을 찾아 설정(# 뒤)을 읽고 대신 읽기 창으로 바꿉니다.
 * 사람이 볼 일은 거의 없습니다. 비밀값은 # 뒤에만 있어 서버·로그에 남지 않습니다 (deploy/setup-worker.sh).
 */
import Layout from '../components/Layout'

export default function WorkerBoot() {
  return (
    <Layout title="대신 읽기 준비 중">
      <div className="section">
        <p className="note">🔄 대신 읽기 준비 중… 확장이 이 탭을 대신 읽기 창으로 바꿉니다. 10초가 지나도 그대로면 확장이 실리지 않은 것입니다.</p>
      </div>
    </Layout>
  )
}
