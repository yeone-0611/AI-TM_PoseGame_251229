/**
 * gameEngine.js
 * Veggie Catch (채소 받기) 게임 로직
 *
 * - 바구니 이동 (Left/Center/Right)
 * - 채소 낙하 및 충돌 처리
 * - 점수 및 레벨 관리
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 15;
    this.isGameActive = false;
    this.gameTimer = null;
    this.loopId = null;

    // 게임 상태
    this.basketPosition = "정면"; // 왼쪽, 정면, 오른쪽
    this.items = []; // 낙하 중인 아이템들
    this.spawnRate = 60; // 아이템 생성 주기 (프레임 단위)
    this.frameCount = 0;
    this.baseSpeed = 1; // 기본 낙하 속도 (2 -> 1로 감소)

    // 아이템 정의
    this.itemTypes = [
      { type: "carrot", icon: "🥕", score: 100, isBomb: false, weight: 4 },
      { type: "cucumber", icon: "🥒", score: 200, isBomb: false, weight: 3 },
      { type: "tomato", icon: "🍅", score: 300, isBomb: false, weight: 2 },
      { type: "pancake", icon: "🥞", score: -500, isBomb: true, weight: 2 },
    ];

    // UI 요소 캐싱
    this.ui = {
      score: document.getElementById("score"),
      time: document.getElementById("time"),
      level: document.getElementById("level"),
      container: document.getElementById("game-container"),
      basket: document.getElementById("basket"),
      reaction: document.getElementById("reaction-message") // 반응 메시지 요소
    };

    // 콜백
    this.onGameEnd = null;
  }

  /**
   * 게임 시작
   */
  start() {
    if (this.isGameActive) return;

    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = 15;
    this.items = [];
    this.basketPosition = "정면";
    this.frameCount = 0;
    this.spawnRate = 60;

    // UI 초기화
    this.updateUI();
    // 바구니와 반응 메시지 요소 다시 연결 (innerHTML 초기화 시 사라질 수 있음)
    // 하지만 여기선 container.innerHTML을 초기화하지 않고 basket만 리셋하거나,
    // 초기 구조를 유지하는 것이 좋음.
    // 기존 코드: this.ui.container.innerHTML = '<div id="basket" class="basket">🧺</div>';
    // 수정: reaction-message도 포함해야 함.
    this.ui.container.innerHTML = `
        <div id="basket" class="basket">🧺</div>
        <div id="reaction-message" class="reaction-message"></div>
    `;
    this.ui.basket = document.getElementById("basket");
    this.ui.reaction = document.getElementById("reaction-message");

    this.moveBasket("정면");

    // 타이머 시작
    this.startTimer();

    // 게임 루프 시작
    this.loop();
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    this.clearTimer();
    if (this.loopId) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 메인 게임 루프 (60fps)
   */
  loop() {
    if (!this.isGameActive) return;

    this.frameCount++;

    // 1. 아이템 생성
    if (this.frameCount % this.spawnRate === 0) {
      this.spawnItem();
    }

    // 2. 아이템 이동 및 충돌 검사
    this.updateItems();

    // 3. 난이도 조절
    this.adjustDifficulty();

    this.loopId = requestAnimationFrame(() => this.loop());
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    // 간단한 확률 로직
    const rand = Math.random();
    let selectedItem;

    if (rand < 0.4) selectedItem = this.itemTypes[0]; // 당근 40%
    else if (rand < 0.7) selectedItem = this.itemTypes[1]; // 오이 30%
    else if (rand < 0.85) selectedItem = this.itemTypes[2]; // 토마토 15%
    else selectedItem = this.itemTypes[3]; // 팬케이크 15%

    // 위치 랜덤 (0: 왼쪽, 1: 중앙, 2: 오른쪽)
    const laneIndex = Math.floor(Math.random() * 3);
    const lanePositions = [25, 125, 225];

    const itemEl = document.createElement("div");
    itemEl.classList.add("item");
    itemEl.innerText = selectedItem.icon;
    itemEl.style.left = lanePositions[laneIndex] + "px";
    itemEl.style.top = "-50px";

    this.ui.container.appendChild(itemEl);

    this.items.push({
      element: itemEl,
      y: -50,
      speed: this.baseSpeed + (this.level * 0.5), // 레벨업 시 속도 증가
      lane: laneIndex, // 0, 1, 2
      data: selectedItem
    });
  }

  /**
   * 아이템 업데이트
   */
  updateItems() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed;
      item.element.style.top = item.y + "px";

      // 충돌 검사 (바구니 Y 위치 대략 420~480)
      if (item.y > 420 && item.y < 480) {
        if (this.checkCollision(item)) {
          // 충돌 발생
          this.handleCollision(item);
          this.removeItem(i);
          continue;
        }
      }

      // 바닥에 닿음 (제거)
      if (item.y > 500) {
        this.removeItem(i);
      }
    }
  }

  /**
   * 충돌 로직
   */
  checkCollision(item) {
    // 현재 바구니 위치 인덱스 (0: 왼쪽, 1: 정면, 2: 오른쪽)
    let basketLane = 1;
    if (this.basketPosition === "왼쪽") basketLane = 0;
    if (this.basketPosition === "오른쪽") basketLane = 2;

    return item.lane === basketLane;
  }

  handleCollision(item) {
    // 점수 처리
    this.score += item.data.score;
    if (this.score < 0) this.score = 0;

    // 반응 메시지 표시
    if (item.data.isBomb) {
      this.showReaction("헉!", "bad");
    } else {
      this.showReaction("냠냠~", "good");
    }

    this.updateUI();
  }

  /**
   * 반응 메시지 표시 ("냠냠~", "헉!")
   */
  showReaction(text, type) {
    if (!this.ui.reaction) return;

    this.ui.reaction.innerText = text;
    this.ui.reaction.className = "reaction-message show"; // reset classes

    if (type === "good") {
      this.ui.reaction.classList.add("reaction-good");
    } else {
      this.ui.reaction.classList.add("reaction-bad");
    }

    // 애니메이션 리셋을 위해 setTimeout 사용 (연속 충돌 시 다시 보여주기 위함)
    // 간단하게는 500ms 후 클래스 제거
    if (this.reactionTimeout) clearTimeout(this.reactionTimeout);

    this.reactionTimeout = setTimeout(() => {
      this.ui.reaction.classList.remove("show");
    }, 500);
  }

  removeItem(index) {
    const item = this.items[index];
    if (item.element.parentNode) {
      item.element.parentNode.removeChild(item.element);
    }
    this.items.splice(index, 1);
  }

  /**
   * 포즈 입력 처리
   * @param {string} pose - "왼쪽", "오른쪽", "정면"
   */
  onPoseDetected(pose) {
    if (!this.isGameActive) return;
    if (this.basketPosition === pose) return; // 같은 포즈면 무시

    this.basketPosition = pose;
    this.moveBasket(pose);
  }

  /**
   * 바구니 이동 시각화
   */
  moveBasket(pose) {
    // Container width 300. Basket width 80.
    // L: 10px, C: 110px, R: 210px
    let leftPos = "110px";
    if (pose === "왼쪽") leftPos = "10px";
    if (pose === "오른쪽") leftPos = "210px";

    if (this.ui.basket) {
      this.ui.basket.style.left = leftPos;
    }
  }

  /**
   * 난이도 및 UI 관리
   */
  adjustDifficulty() {
    // 레벨업 (1000점 마다)
    const newLevel = Math.floor(this.score / 1000) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      // 스폰 속도 증가 (최소 20프레임)
      this.spawnRate = Math.max(20, 60 - (this.level * 5));
      this.updateUI();
    }
  }

  startTimer() {
    this.gameTimer = setInterval(() => {
      this.timeLimit--;
      this.updateUI();

      if (this.timeLimit <= 0) {
        this.stop();
        alert(`게임 종료!\n최종 점수: ${this.score}`);
      }
    }, 1000);
  }

  clearTimer() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  updateUI() {
    if (this.ui.score) this.ui.score.innerText = this.score;
    if (this.ui.time) this.ui.time.innerText = this.timeLimit;
    if (this.ui.level) this.ui.level.innerText = this.level;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
}

// 전역 내보내기
window.GameEngine = GameEngine;
