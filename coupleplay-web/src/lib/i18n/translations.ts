import type { Language } from "./languages";

export const translations = {
  en: {
    // Home Page
    home: {
      hero: {
        title: "Play together, anytime 💕",
        subtitle:
          "Fun games designed for couples. Start a room, share the link with your partner, and enjoy some quality time together.",
        readyTitle: "Ready to play?",
        readySubtitle: "Pick a game below and create your private room!",
      },
      createRoom: {
        title: "Create your room",
        subtitle: "Enter your name, pick a game, and get your invite link!",
        nameLabel: "Your name",
        namePlaceholder: "Jordan, Alex...",
        hideQuestionsLabel: "Keep questions secret until we start answering 🤫",
        createButton: "Create room 🎮",
        creatingButton: "Creating your room... ✨",
        roomReady: "Room ready! Share with your partner:",
        copyLink: "Copy link",
        copied: "Copied! ✓",
        enterRoom: "Enter room",
      },
      howItWorks: {
        title: "How it works",
        step1Title: "Create your room",
        step1Desc: "Pick a game and get your link",
        step2Title: "Share with your partner",
        step2Desc: "They tap the link and enter their name",
        step3Title: "Play together!",
        step3Desc: "Have fun and enjoy quality time",
        tip: "Tip:",
        tipText:
          "Rooms stay active while you're playing and close after being idle for an hour.",
      },
      ourGames: {
        title: "Our games",
        subtitle: "Pick the vibe that fits your mood!",
      },
      games: {
        randomQuestions: {
          title: "Random Questions",
          gist: "Ask anything, answer together, and see what you both think.",
          detail:
            "First, you both add questions (keep them secret if you want!). Then, take turns answering while your partner watches you type.",
        },
        ideaMatching: {
          title: "Idea Matching",
          gist: "Find out what you're both into without the awkward reveals.",
          detail:
            "Each of you votes yes or no on ideas. Only the ones you BOTH like get revealed at the end. Perfect for discovering shared interests!",
        },
      },
    },

    // Room Page
    room: {
      header: {
        subtitle: "You're in! Just follow along and have fun together.",
      },
      connection: {
        welcomeTitle: "Welcome!",
        welcomeSubtitle: "Enter your name to join the fun!",
        namePlaceholder: "Your name",
        joinButton: "Join room 🎮",
        joiningButton: "Joining... ✨",
        you: "You",
        yourPartner: "Your partner",
        waitingForPartner: "Waiting for your partner...",
      },
      collect: {
        title: "Add your questions",
        subtitleHidden:
          "Your questions are kept secret for now. They'll be revealed when you start answering!",
        subtitleVisible:
          "Add as many questions as you'd like. You'll both see them as they're added.",
        ready: "Ready! ✓",
        addingQuestions: "Adding questions...",
        doneButton: "I'm done adding questions ✓",
        bothReadyWaiting: "Both ready! Starting soon... ✨",
        readyWaitingFor: "Ready! Waiting for {partner}...",
        questionPlaceholder: "What do you want to ask? 💭",
        addButton: "Add",
        questionsWillAppear: "Your questions will appear here",
        questionCount: "{count} question",
        questionCountPlural: "{count} questions",
        startAdding: "Start adding questions above!",
        addedBy: "Added by {name}",
        suggestionTitle: "Need inspiration? 💡",
        useSuggestion: "Use this question",
        nextSuggestion: "Next suggestion",
        loadingSuggestion: "Loading...",
      },
      answer: {
        title: "Time to answer!",
        subtitle: "Take turns answering. Your partner can watch you type live!",
        yourTurn: "Your turn! 🎯",
        partnerTurn: "{name}'s turn",
        questionLabel: "Question",
        yourAnswerLabel: "Your answer:",
        answerPlaceholder: "Type your answer here... your partner is watching! 👀",
        submitButton: "Submit answer",
        answerSubmitted: "Answer submitted! ✓",
        waitingForPartner: "Waiting for {name} to read your answer...",
        partnerTyping: "{name} is typing...",
        waitingForAnswer: "Waiting for their answer...",
        confirmButton: "I read it, next question!",
        confirmed: "Confirmed! ✓",
        waitingForFinish: "Waiting for {name} to finish...",
        gettingReady: "Getting ready...",
        progressLabel: "Progress",
        progressCount: "{completed}/{total} answered",
      },
      review: {
        title: "You did it!",
        subtitle:
          "Here's everything you both shared. Take your time reading through!",
        answeredBy: "{name} answered:",
        noAnswer: "No answer provided",
        playAgainTitle: "🎮 Want to play again?",
        playAgainSubtitle: "Head back to the home page to start a new room!",
      },
    },

    // Footer
    footer: {
      language: "Language",
    },
  },

  "pt-BR": {
    // Home Page
    home: {
      hero: {
        title: "Joguem juntos, a qualquer hora 💕",
        subtitle:
          "Jogos divertidos feitos para casais. Crie uma sala, compartilhe o link com seu parceiro(a) e aproveite um tempo de qualidade juntos.",
        readyTitle: "Prontos para jogar?",
        readySubtitle: "Escolha um jogo abaixo e crie sua sala privada!",
      },
      createRoom: {
        title: "Crie sua sala",
        subtitle: "Digite seu nome, escolha um jogo e pegue seu link de convite!",
        nameLabel: "Seu nome",
        namePlaceholder: "João, Maria...",
        hideQuestionsLabel: "Manter perguntas secretas até começarmos a responder 🤫",
        createButton: "Criar sala 🎮",
        creatingButton: "Criando sua sala... ✨",
        roomReady: "Sala pronta! Compartilhe com seu parceiro(a):",
        copyLink: "Copiar link",
        copied: "Copiado! ✓",
        enterRoom: "Entrar na sala",
      },
      howItWorks: {
        title: "Como funciona",
        step1Title: "Crie sua sala",
        step1Desc: "Escolha um jogo e pegue seu link",
        step2Title: "Compartilhe com seu parceiro(a)",
        step2Desc: "Eles clicam no link e digitam o nome",
        step3Title: "Joguem juntos!",
        step3Desc: "Divirtam-se e aproveitem o tempo juntos",
        tip: "Dica:",
        tipText:
          "As salas ficam ativas enquanto vocês jogam e fecham após uma hora de inatividade.",
      },
      ourGames: {
        title: "Nossos jogos",
        subtitle: "Escolha o clima que combina com vocês!",
      },
      games: {
        randomQuestions: {
          title: "Perguntas Aleatórias",
          gist: "Pergunte qualquer coisa, respondam juntos e vejam o que ambos pensam.",
          detail:
            "Primeiro, vocês dois adicionam perguntas (mantenham em segredo se quiserem!). Depois, se revezam respondendo enquanto o parceiro(a) assiste você digitando.",
        },
        ideaMatching: {
          title: "Combinação de Ideias",
          gist: "Descubram no que vocês estão afim sem revelações constrangedoras.",
          detail:
            "Cada um vota sim ou não nas ideias. Apenas as que AMBOS gostam são reveladas no final. Perfeito para descobrir interesses em comum!",
        },
      },
    },

    // Room Page
    room: {
      header: {
        subtitle: "Você entrou! Apenas sigam em frente e divirtam-se juntos.",
      },
      connection: {
        welcomeTitle: "Bem-vindo(a)!",
        welcomeSubtitle: "Digite seu nome para entrar na diversão!",
        namePlaceholder: "Seu nome",
        joinButton: "Entrar na sala 🎮",
        joiningButton: "Entrando... ✨",
        you: "Você",
        yourPartner: "Seu parceiro(a)",
        waitingForPartner: "Esperando seu parceiro(a)...",
      },
      collect: {
        title: "Adicione suas perguntas",
        subtitleHidden:
          "Suas perguntas ficam em segredo por enquanto. Elas serão reveladas quando vocês começarem a responder!",
        subtitleVisible:
          "Adicione quantas perguntas quiser. Vocês dois vão vê-las conforme são adicionadas.",
        ready: "Pronto! ✓",
        addingQuestions: "Adicionando perguntas...",
        doneButton: "Terminei de adicionar perguntas ✓",
        bothReadyWaiting: "Ambos prontos! Começando em breve... ✨",
        readyWaitingFor: "Pronto! Esperando por {partner}...",
        questionPlaceholder: "O que você quer perguntar? 💭",
        addButton: "Adicionar",
        questionsWillAppear: "Suas perguntas aparecerão aqui",
        questionCount: "{count} pergunta",
        questionCountPlural: "{count} perguntas",
        startAdding: "Comece adicionando perguntas acima!",
        addedBy: "Adicionada por {name}",
        suggestionTitle: "Precisa de inspiração? 💡",
        useSuggestion: "Usar esta pergunta",
        nextSuggestion: "Próxima sugestão",
        loadingSuggestion: "Carregando...",
      },
      answer: {
        title: "Hora de responder!",
        subtitle: "Se revezem respondendo. Seu parceiro(a) pode ver você digitando ao vivo!",
        yourTurn: "Sua vez! 🎯",
        partnerTurn: "Vez de {name}",
        questionLabel: "Pergunta",
        yourAnswerLabel: "Sua resposta:",
        answerPlaceholder: "Digite sua resposta aqui... seu parceiro(a) está assistindo! 👀",
        submitButton: "Enviar resposta",
        answerSubmitted: "Resposta enviada! ✓",
        waitingForPartner: "Esperando {name} ler sua resposta...",
        partnerTyping: "{name} está digitando...",
        waitingForAnswer: "Esperando a resposta...",
        confirmButton: "Eu li, próxima pergunta!",
        confirmed: "Confirmado! ✓",
        waitingForFinish: "Esperando {name} terminar...",
        gettingReady: "Preparando...",
        progressLabel: "Progresso",
        progressCount: "{completed}/{total} respondidas",
      },
      review: {
        title: "Vocês conseguiram!",
        subtitle:
          "Aqui está tudo que vocês compartilharam. Leiam com calma!",
        answeredBy: "{name} respondeu:",
        noAnswer: "Nenhuma resposta fornecida",
        playAgainTitle: "🎮 Querem jogar de novo?",
        playAgainSubtitle: "Voltem para a página inicial para criar uma nova sala!",
      },
    },

    // Footer
    footer: {
      language: "Idioma",
    },
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(lang: Language) {
  return translations[lang] || translations.en;
}

// Helper function to replace placeholders like {name}, {count}, etc.
export function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;

  return Object.keys(params).reduce((result, key) => {
    return result.replace(new RegExp(`\\{${key}\\}`, "g"), String(params[key]));
  }, text);
}
