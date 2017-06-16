
$(function() {
  // UI
  var ramalLivre = $("#ramalLivreDiv"),
    ramalEmUso = $("#ramalAtendimentoDiv"),
    emChamadaDiv = $("#emChamadaDiv"),
    loginForm = $("#loginForm"),
    tituloRamalEmUso = emChamadaDiv.find('h4'),
    textoRamalEmUso = emChamadaDiv.find('span'),
    textoChamadaDiscador = ramalEmUso.find('#chamadaDiscadorDiv'),
    errorPanel = $("#alertError"),
    chamadaAtual,
    chamadaEmEspera,
    adapter = $.epbxManagerClient,
    events = $.epbxManagerClient.events,
    windowHandler = $(window),
    discarInput = $("#discarInput"),
    ultimoGlobalId,
    intervaloAtual = {},
    intervaloOptions = {},
    regExNotNumbers = /[^0-9]+/
	stopCalled = false;

  var signalrDesconectado = false;

  mostrarRamalDeslogado();
  $("#ipInput").parent().hide();
  $("#idPaInput").parent().hide();
  $("#btnTiraEspera").hide();
  $("#loginSubmit").hide();

  setIpLocal();

  function loginError(errMessage) {
    hideAllPanels();
    loginForm.show();
    showError(errMessage.Message || errMessage.message || "Erro ao realizar o login. Tente novamente ou contate o suporte");
  }

  function showError(message) {
    errorPanel.show();
    errorPanel.text(message);
    $('html, body').animate({
      scrollTop: errorPanel.offset().top
    }, 300);
  }

  function commandError(err) {
    if (err && err.message) {
      showError("Erro ao executar comando: " + err.message);
    } else {
      showError("Houve um erro ao executar o comando");
    }
  }

  function parsePhone(text) {
    return (text || "").toString().replace(regExNotNumbers, "");
  }

  function hideAllPanels() {
    $("body > div > div.container-fluid > div.row").hide();
    errorPanel.hide();
  }

  function mostrarRamalLivre(errorMessage) {
    resetTransferirPanels();
    hideAllPanels();
    $("#btnConferenciaIniciar").hide();
    ramalLivre.show();
    if (errorMessage) {
      showError(errorMessage);
    }
  }

  function mostrarRamalDeslogado() {
    hideAllPanels();
    loginForm.show();
    formLoginReady();
	adapter.desconectar();
  }

  function mostrarChamada(chamada, texto) {
    hideAllPanels();

    ramalEmUso.show();

    tituloRamalEmUso.text(texto);

    if (chamada && chamada.Telefone) {

      textoRamalEmUso.html("Número remoto: " + chamada.Telefone + (chamada.DDRLocal ? "<br>Número Local: " + chamada.DDRLocal : ""));

      $("#btnDesligarChamada").show();

      // se não for um evento da chamada em Consulta, reseta o painel de Transferencia de Chamada
      if (!chamadaEmEspera) resetTransferirPanels();
    } else {

      textoRamalEmUso.html("<div id='loadingPanel' class='glyphicon glyphicon-refresh glyphicon-spin'></div>");

      $("#btnDesligarChamada").hide();

      if (!chamadaEmEspera) {
        $("#transferirEtapa1Panel").hide();
        $("#transferirEtapa2Panel").hide();
        $("#esperaPanel").hide();
      }
    }

    // se for chamada do discador, o objeto de chamada possuira mais dados
    if (chamada.CodigoCampanha) {
      textoChamadaDiscador.html("CodigoCliente: " + chamada.CodigoCliente + "<br>" +
        "NomeCliente: " + chamada.NomeCliente + "<br>" +
        "CodigoCampanha: " + chamada.CodigoCampanha + "<br>" +
        "TelefoneCliente: " + chamada.TelefoneCliente + "<br>" +
        "InfoAdicional1: " + chamada.InfoAdicional1 + "<br>" +
        "InfoAdicional2: " + chamada.InfoAdicional2 + "<br>" +
        "InfoAdicional3: " + chamada.InfoAdicional3 + "<br>" +
        "InfoAdicional4: " + chamada.InfoAdicional4 + "<br>" +
        "InfoAdicional5: " + chamada.InfoAdicional5);
    } else {
      textoChamadaDiscador.html("");
    }
  }

  function toggleChamadaEmEspera() {
      var btnEspera = $("#btnEspera");
      if (btnEspera.is(':visible')) {
          $("#btnTiraEspera").show();
          btnEspera.hide();
          $("#transferirEtapa1Panel").hide();
      } else {
          btnEspera.show();
          $("#btnTiraEspera").hide();
          $("#transferirEtapa1Panel").show();
      }
  }

  function mostrarChamadaEmEsperaConsulta(chamada) {
    if (chamada) {
      chamadaEmEspera = chamada;
      $("#chamadasEmEsperaList").html("<li class='list-group-item'>" + chamada.Telefone + "</li>");
      $("#emChamadaDiv").hide();
      $("#esperaPanel").hide();
    } else {
      chamadaEmEspera = null;
      $("#chamadasEmEsperaList").html("");
      $("#emChamadaDiv").show();
      $("#esperaPanel").show();
    }
  }

  function mostrarIntervaloStatus(ramalStatusDetalheId) {
    var intervalo = intervaloOptions[ramalStatusDetalheId];
    if (intervalo) {
      $("#intervaloStatus").text(intervalo.Descricao);
    }
  }

  function updateIntervalorOptions() {
    var select = $("#intervaloSelect"),
      value, key, option;

    select.find("option").remove();

    for (key in intervaloOptions) {
      // não adicionar ao combo o intervalo atual, já que a telefonia retornará erro se enviar o mesmo intervalo
      if (key != intervaloAtual.RamalStatusDetalheId) {
        value = intervaloOptions[key];
        option = $("<option></option>")
          .attr("value", key)
          .text(key + " - " + value.Descricao + " - " + (value.Produtivo ? "Produtivo" : "Improdutivo"));
        select.append(option);
      }
    }
  }

  function formLoginLoading() {
    $("#loginForm").find("input").attr("disabled", true);
    $("#loginSubmit").button('loading');
  }

  function formLoginReady() {
    $("#loginForm").find("input").attr("disabled", false);
    $("#loginSubmit").button('reset');
  }

  $("#loginSubmit").click(function() {
    var idPaOrIpOrRamal, tipoLogon;
    formLoginLoading();

    if ($("#optionIsIP").is(":checked")) {
      idPaOrIpOrRamal = $("#ipInput").val();
      if (idPaOrIpOrRamal.length <= 4) {
        tipoLogon = adapter.TipoLogon.RamalVirtual;
      } else {
        tipoLogon = adapter.TipoLogon.Ip;
      }
    } else {
      idPaOrIpOrRamal = parseInt(parsePhone($("#idPaInput").val()));
      tipoLogon = adapter.TipoLogon.IdPa;
    }

	stopCalled = false;

    // o login no atendimento é composto de 3 etapas:
    // 1º autenticação e obtenção do access token
    // 2º abrir conexão persistente com o servidor com websockets (via api signalr, com fallback para browsers sem suporte a websockets)
    // 3º envio de comando no websocket para iniciar/conectar o atendimento
    adapter.login($("#usernameInput").val(), $("#passwordInput").val(), idPaOrIpOrRamal, tipoLogon)
      .then(adapter.conectarSignalr)
      .then(adapter.iniciarAtendimento)
      .fail(loginError)
      .fail(formLoginReady);

    return false;
  });

  $("#optionIsIP").click(function() {
    $("#idPaInput").parent().hide();
    $("#ipInput").parent().show();
    $("#loginSubmit").show();
  });

  $("#optionIsHD").click(function() {
    $("#ipInput").parent().hide();
    $("#idPaInput").parent().show();
    $("#loginSubmit").show();
  });

  $("#btnDiscar").click(function() {
    var numero = discarInput.val();

    if (!numero) {
      showError("Número inválido");
      return false;
    }

    var tipoDiscagem = adapter.getTipoDiscagem($("#externoCheckbox"));

    // mostrar desligar apenas apos evento onDisca
    mostrarChamada({}, "Realizando chamada");

    // todos os comandos remotos retornam um objeto deferred do jquery, tornando possivel usar os metodos then/fail em todos os comandos
    // https://api.jquery.com/category/deferred-object/
    adapter.server.discar(numero, tipoDiscagem)
      .then(function() {
        // apenas mostrar o botao desligar apos a confirmacao do comando
        // $("#btnDesligarChamada").show(); // no momento a função desligar só funciona após o recebimento dos eventos onDisca / onChamada / onAtendido
      })
      .fail(function(err) {
        mostrarRamalLivre();
        commandError(err);
      });

    return false;
  });

  $("#btnDesligarChamada").click(function() {
    adapter.server.desligar().fail(commandError);
    return false;
  });

  $("#btnCapturar").click(function() {
    var numero = parseInt($("#capturarInput").val());
    adapter.server.capturaDirigida(numero).fail(commandError);
    return false;
  });

  $("#btnAlterarIntervalo").click(function() {
    adapter.server.alterarIntervaloTipo($("#intervaloSelect").val()).fail(commandError);
    return false;
  });

  $("#btnConsultar").click(function() {
    var numero = parsePhone($("#transferirInput").val());
    if (!numero) {
      showError("Número inválido");
      return false;
    }

    var tipoDiscagem = adapter.getTipoDiscagem($("#transferirExternoCheckbox"));

    var emEspera = chamadaAtual;

    // para numeros externos, é obrigatório chamar o metodo de consulta antes de transferir a ligação
    // o metodo de consulta colocará a chamada atual em espera e discará para o número de destino para a transferencia
    adapter.server.consultar(numero, tipoDiscagem)
      .then(function() {
        // chamada atual ficou em espera
        mostrarChamadaEmEsperaConsulta(emEspera);
        $("#transferirEtapa2Panel").find("h3").text("Em consulta com o número " + numero);
      })
      .fail(function(err) {
        mostrarChamada(emEspera);
        resetTransferirPanels();
        commandError(err);
      });

    $("#transferirEtapa1Panel").hide();
    $("#transferirEtapa2Panel").show();

    return false;
  });

  function resetTransferirPanels() {
    mostrarChamadaEmEsperaConsulta(null);
    $("#esperaPanel").show();
    $("#transferirEtapa1Panel").show();
    $("#transferirEtapa2Panel").hide();
  }

  $("#btnTransferir").click(function() {
    // transfere a chamada que foi colocada em espera pelo metodo de consulta para a chamada em curso
   adapter.server.transferir()
      .then(function() {
        resetTransferirPanels();
      })
      .fail(commandError);

    return false;
  });

  $("#btnLiberarConsulta").click(function() {
    // desliga a chamada em consulta e volta para a chamada que estava em espera
    adapter.server.liberarConsulta()
      .then(function() {
        mostrarChamada(chamadaEmEspera);
        resetTransferirPanels();
      })
      .fail(commandError);

    return false;
  });

  // conferencia
  $("#btnConferenciaAdicionar").click(function() {
    var numero = parsePhone($("#conferenciaAddInput").val());
    var tipoDiscagem = adapter.getTipoDiscagem($("#conferenciaExternoCheckbox"));

    var li = $("<li class='list-group-item'>" + numero + "<button type='button' class='close' aria-label='Remover'><span aria-hidden='true'>&times;</span></button></li>");
    li.data("tipoDiscagem", tipoDiscagem);

    $("#conferenciaNumerosList").append(li);
    $("#btnConferenciaIniciar").show();

    li.find("button").click(function() {
      $(this).parent().remove();
    });

    $("#conferenciaAddInput").val("");

    return false;
  });

  $("#btnConferenciaIniciar").click(function() {
    var adicionarPromises = [],
      newParticipante;
    var participantesList = $("#conferenciaParticipantesList");
    participantesList.find("li").remove();

    $("#conferenciaNumerosList").find("li").each(function(index, li) {
      li = $(li);
      adicionarPromises.push(adapter.server.conferenciaAdicionar(parsePhone(li.text()), li.data("tipoDiscagem")));
      newParticipante = $("<li class='list-group-item'><span class='badge glyphicon glyphicon-refresh glyphicon-spin'></span>" + parsePhone(li.text()) + "</li>");
      participantesList.append(newParticipante);
    });

    // só apenas a confirmação de que todos os numeros foram adicionados na memoria do ramal, iniciamos a conferencia
    $.when(adicionarPromises).then(function() {
      adapter.server.conferenciaIniciar().fail(commandError);
    }).fail(function(errs) {
      var err = {
        message: ""
      };
      for (var e in errs) {
        err.message += e.message + "\n";
      }
      commandError(err);
    });

    return false;
  });

  $("#btnConferenciaTerminar").click(function() {
    adapter.server.conferenciaTerminar().fail(commandError);
    return false;
  });

  $("#btnDeslogar").click(function() {
	stopCalled = true;
    adapter.server.terminar().then(mostrarRamalDeslogado).fail(commandError);
    return false;
  });


	$("#btnTiraEspera").click(function() {
		adapter.server.terminarEspera()
			.then(toggleChamadaEmEspera)
			.fail(commandError);
	});

	$("#btnEspera").click(function() {
	    chamadaEmEspera = chamadaAtual;

		adapter.server.iniciarEspera()
			.then(toggleChamadaEmEspera)
			.fail(commandError);
	});

  var telefonia = {};

  //telefonia.discar = function(numero,tipoDiscagem){
	//  adapter.server.discar(numero, tipoDiscagem)
//		.then(telefonia.retornoDiscagem(true, "Sucess"))
//		.fail(telefonia.retornoDiscagem(false, err)});
//  };

//  telefonia.retornoDiscagem = function(sucesso, mesnagem){
	  // to do
	  // to do
	  // to do
//  }



  // eventos do atendimento
  windowHandler.on(events.onLogado, function(event, ramal) {
	  alert("onLogado");
    mostrarRamalLivre();
    $("#titleRamalLogado").text("Ramal Logado - " + ramal.Ramal);
    hideDownloadChamada();
  });

  windowHandler.on(events.onDeslogado, function(event, ramal) {
	  alert("onDeslogado");
    mostrarRamalDeslogado();
  });

  windowHandler.on(events.onLogadoErro, function(event, ramal, ex) {
	   alert("onLogadoErro");
    mostrarRamalDeslogado();
    loginError(ex);
  });

  // tratar quebra de conexao do Atendimento
  windowHandler.on(events.onConexaoErro, function(event, ramal, ex) {
	  alert("onConexaoErro");
    console.log(ex.Message);
    showError("Há um problema na conexão com o servidor de Telefonia. Tentando reconexão...");
    // tentamos reconectar em 5 segundos
    setTimeout(reconectaAtendimento, 5000);
  });

  // tratar quebra de conexao com o Signalr
  windowHandler.on(events.onSignalrDisconnected, function() {
	  alert("onSignalrDisconnected");
    if (!stopCalled && !signalrDesconectado) {
      // tentamos reconectar em 5 segundos
      showError("Há um problema na conexão com o servidor. eTentando reconexão...");
      console.log('onSignalrDisconnected');
      setTimeout(reconectaSignalr, 5000);
      signalrDesconectado = true;
    }
  });

  windowHandler.on(events.onChamada, function(event, ramal, chamada) {
	  alert("onChamada");
    chamadaAtual = chamada;
    mostrarChamada(chamada, "Recebendo chamada");
    // recebimento de chamada normal ou de discador.
    // Quando discador, o objeto chamada contera os campos
    // codigoCliente
    // nomeCliente
    // codigoCampanha
    // telefoneCliente
    // infoAdicional1
    // infoAdicional2
    // infoAdicional3
    // infoAdicional4
    // infoAdicional5
  });

  windowHandler.on(events.onDisca, function(event, ramal, chamada) {
	alert("onDisca");
    chamadaAtual = chamada;
    mostrarChamada(chamada, "Realizando chamada");

  });

  windowHandler.on(events.onDiscaErro, function(event, ramal, ex) {
	  alert("onDiscaErro");
    mostrarRamalLivre("Não foi possível completar a chamada");
  });

  windowHandler.on(events.onDiscaStatus, function(event, ramal, chamada, status) {
	  alert("onDiscaStatus");
    window.setTimeout(function() {
      // o evento onDiscaStatus vem antes do onDesliga, então a mensagem de erro estava sendo apagada.
      // encapsulamos a escrita da mensagem de erro em um timeout para contornar o problema no fluxo da UI
      mostrarRamalLivre("Erro na discagem: " + adapter.StatusDiscagemExterno[status.StatusDiscagem]);
    }, 200);
  });

  windowHandler.on(events.onChamadaGlobalId, function(event, ramal, chamada, globalId) {
	   alert("onChamadaGlobalId");
    ultimoGlobalId = globalId;
    alterarHrefDownloadChamada();
  });

  windowHandler.on(events.onAtendido, function(event, ramal, chamada) {
	  alert("onAtendido");
    chamadaAtual = chamada;
    mostrarChamada(chamada, "Chamada atendida");
    // funções de transferencia só podem aparecer após atender a chamada
    resetTransferirPanels();
  });

  windowHandler.on(events.onDesliga, function(event, ramal, chamada) {
	  alert("onDesliga");
      chamadaAtual = null;
      mostrarRamalLivre();
  });

  // a telefonia manda todos os intervalos disponiveis para este ramal, um de cada vez
  windowHandler.on(events.onInfoIntervaloRamal, function(event, ramal, infoIntervalo) {
	  alert("onInfoIntervaloRamal");
    intervaloOptions[infoIntervalo.RamalStatusDetalheId] = {
      Descricao: infoIntervalo.Descricao,
      Produtivo: infoIntervalo.Produtivo
    };

    if (intervaloAtual.RamalStatusDetalheId === infoIntervalo.RamalStatusDetalheId) {
      mostrarIntervaloStatus(infoIntervalo.RamalStatusDetalheId);
    }

    updateIntervalorOptions();
  });

  windowHandler.on(events.onSetIntervaloRamal, function(event, ramal, intervalo) {
	  alert("onSetIntervaloRamal");
    // ao trocar de intervalo, apenas recebemos o id do intervalo novo.
    intervaloAtual = {
      RamalStatusDetalheId: intervalo.RamalStatusDetalheId
    }
    mostrarIntervaloStatus(intervalo.RamalStatusDetalheId);

    updateIntervalorOptions();
  });

  // conferencia
  var findParticipante = function(numero) {
    return $("#conferenciaParticipantesList").find("li:contains('" + numero + "')");
  }

  windowHandler.on(events.onConferenciaInicio, function(event, ramal) {
	  alert("onConferenciaInicio");
    hideAllPanels();
    $("#ramalConferenciaDiv").show();
  });

  windowHandler.on(events.onConferenciaDisca, function(event, ramal, chamada) {
	  alert("onConferenciaDisca");
    findParticipante(chamada.Telefone).find("span").attr('class', 'badge text-info').text("Discando");
  });

  windowHandler.on(events.onConferenciaDiscaErro, function(event, ramal, chamada) {
	  alert("onConferenciaDiscaErro");
    findParticipante(chamada.Telefone).find("span").attr('class', 'badge text-danger').text("Erro de discagem");
  });

  windowHandler.on(events.onConferenciaAtendido, function(event, ramal, chamada) {
	  alert("onConferenciaAtendido");
    findParticipante(chamada.Telefone).find("span").attr('class', 'badge text-success').text("Atendido");
  });

  windowHandler.on(events.onConferenciaChamadaEncerrada, function(event, ramal, chamada) {
	   alert("onConferenciaChamadaEncerrada");
    findParticipante(chamada.Telefone).find("span").attr('class', 'badge text-muted').text("Encerrado");
  });

  windowHandler.on(events.onConferenciaTermino, function(event, ramal, chamada) {
	  alert("onConferenciaTermino");
    mostrarRamalLivre();
  });

  windowHandler.on(events.onConferenciaErro, function(event, ramal, ex) {
	  alert("onConferenciaErro");
    console.error(ex);
    mostrarRamalLivre("Erro ao iniciar conferência");
  });

  /* Eventos de consulta */
  windowHandler.on(events.onConsultaAtendido, function(event, ramal, chamada) {
    console.log('onConsultaAtendido')
  });

  windowHandler.on(events.onConsultaChamada, function(event, ramal, chamada) {
	  alert("onConsultaChamada");
    console.log('onConsultaChamada')
  });

  function reconectaSignalr() {
    console.log('reconectaSignalr');
    adapter.conectarSignalr().fail(function() {
      console.log('reconectaSignalr-fail');
      showError("Há um problema na conexão com o servidor. Tentando conexão...");
      setTimeout(reconectaSignalr, 5000);
    }).then(function() {
      signalrDesconectado = false;
      console.log('reconectaSignalr-then')
      adapter.iniciarAtendimento();
    });
  };

  function reconectaAtendimento() {
    adapter.iniciarAtendimento().fail(function() {
      showError("Há um problema na conexão com o servidor de Telefonia. Tentando conexão...");
      // tentamos reconectar em 5 segundos
      setTimeout(reconectaAtendimento, 5000);
    });
  };

  function alterarHrefDownloadChamada() {
    var link = "";
    hideDownloadChamada();

    $("#btnDownloadChamada").attr("href", adapter.getUrlDownloadChamada(ultimoGlobalId));
    $("#globalIdLabel").text(ultimoGlobalId);
    $("#downloadChamadaPanel").show();
  };

  function hideDownloadChamada() {
    $("#downloadChamadaPanel").hide();
  };

  // tenta identificar o ip da maquina
  function setIpLocal() {
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	
	if(!window.RTCPeerConnection) {
		return;
	}
	
    var pc = new RTCPeerConnection({
        iceServers: []
      }),
      noop = function() {};
    pc.createDataChannel(""); //create a bogus data channel
    pc.createOffer(pc.setLocalDescription.bind(pc), noop); // create offer and set local description
    pc.onicecandidate = function(ice) { //listen for candidate events
      if (!ice || !ice.candidate || !ice.candidate.candidate) return;
      var myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)[1];

      //Set IP
      $("#ipInput").val(myIP);

      pc.onicecandidate = noop;
    };
  };

  $("#pageContainer").removeClass("hidden");
  $("#loadingPage").hide();
});
