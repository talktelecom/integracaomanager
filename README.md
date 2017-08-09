
# Integração Epbx Manager

A api de integração do Epbx Manager possui um conjunto de métodos que facilitam a integração. 


## Configuração

Para utilizar a api de integração você precisa fazer a referência do java script abaixo em seu site.


```html
<script src="http://integracao.epbx.com.br/Service/scripts/jquery-3.1.0.min.js">
<script src="http://integracao.epbx.com.br/Service/scripts/jquery.signalR.min.js"></script>
<script src="http://integracao.epbx.com.br/Service/signalr/hubs"></script>
<script src="app/epbxManagerConfig.js"></script>
<script src="app/epbxManagerConnection.js"></script>

```

## Função para obter IP da máquina
```javascript
function setIpLocal() {
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
                var pc = new RTCPeerConnection({
                iceServers: []
                }), noop = function() {};
                pc.createDataChannel(""); //create a bogus data channel
                pc.createOffer(pc.setLocalDescription.bind(pc), noop); // create offer and set local description
                pc.onicecandidate = function(ice) { //listen for candidate events
                if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                var myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)[1];
 
                //Colocar o ip no textbox
                $("#ipInput").val(myIP);
 
                pc.onicecandidate = noop;
                };
  };
```


## Função para Logar Ramal
###     

```javascript
  $("#loginSubmit").click(function() {
    var idPaOrIpOrRamal, tipoLogon;
    
    // Próximo passo verifico qual seria o seu tipo de logon (CTI IP , CTI Analógico)
    // Para CTI Analógico precisamos do ID da PA.
    // Para CTI IP temos dois meios de login.
    // 1º Seria pegar o IP da Máquina local aonde está o SoftPhone. 
    // 2º Seria para pegar o ramal virtual para Telefones IP.
    
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

```
## Função para mudar o intervalo do ramal

```javascript
  $("#btnAlterarIntervalo").click(function() {
    var codigoIntervalo = $("#intervaloSelect").val();  
    adapter.server.alterarIntervaloTipo(codigoIntervalo).fail(commandError);
    return false;
  });
```

## Função callback para receber o intervalo atual do ramal


```javascript
  windowHandler.on(events.onSetIntervaloRamal, function(event, ramal, intervalo) {
	  alert("onSetIntervaloRamal");
    // ao trocar de intervalo, apenas recebemos o id do intervalo novo.
    intervaloAtual = {
      RamalStatusDetalheId: intervalo.RamalStatusDetalheId
    }
    mostrarIntervaloStatus(intervalo.RamalStatusDetalheId);

    updateIntervalorOptions();
  });
```

## Função callback para receber os intervalos disponiveis para esse ramal
```javascript
  // A telefonia manda todos os intervalos disponiveis para este ramal, um de cada vez
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
```

## Função callback para receber o evento de chamada atendida
```javascript
   windowHandler.on(events.onAtendido, function (event, ramal, chamada) {
        //GlobalId, é utilizado para fazer o download do mp3 da chamada
	var globalId = chamada.GlobalId;
	
	var texto = '';
        
		// chamada ura_callback
		if(chamada.InfoAdicional1 == "URA_CALLBACK"){
		   atualizaStatus("Recebendo chamada Ura Callback");
           texto = "TelefoneCliente: " + chamada.Telefone;
           chamadaReceptiva(chamada.Telefone);	
		}		
		// se for chamada do discador, o objeto de chamada possuira mais dados
        else if (chamada.CodigoCampanha) {
            atualizaStatus("Recebendo chamada ativa");
            texto = "CodigoCliente: " + chamada.CodigoCliente + " | " +
                    "NomeCliente: " + chamada.NomeCliente + " | " +
                    "CodigoCampanha: " + chamada.CodigoCampanha + " | " +
                    "TelefoneCliente: " + chamada.TelefoneCliente + " | " +
                    "InfoAdicional1: " + chamada.InfoAdicional1 + " | " +
                    "InfoAdicional2: " + chamada.InfoAdicional2 + " | " +
                    "InfoAdicional3: " + chamada.InfoAdicional3 + " | " +
                    "InfoAdicional4: " + chamada.InfoAdicional4 + " | " +
                    "InfoAdicional5: " + chamada.InfoAdicional5;
            chamadaAtiva(chamada.CodigoCliente, chamada.Telefone);
        } else if (chamada.Direcao == 2)
        {
            atualizaStatus("Recebendo chamada receptiva");
            texto = "TelefoneCliente: " + chamada.Telefone + " | " +
                    "DDR Local: " + chamada.DDRLocal;
            chamadaReceptiva(chamada.Telefone);
        }
        if (texto != '')
        {
            atualizaStatus(texto);
        }        
    });
```


## Integração com o Power

#Procedure para reativar o cliente
```sql
Exec dbo.proc_reativa_cliente 
 @Campanha    = '' -- Código da campanha
,@CodCliente  = '' -- Código do cliente
,@DDD         = '' -- DDD
,@Telefone    = '' -- Número do telefone 
,@Prioridade  =  0 -- 1 = Possui prioridade na discagem | 0 = Não possui prioridade
```

#Procedure para agendar o cliente
```sql
 Exec PowerC.dbo.proc_agenda_telefone
 @Campanha   = 1,
 @CodCliente = '123456',
 @DDD        = 11,
 @Telefone   = 21879021,
 @DataHora   = '2017-07-26 16:45',
 @Ramal      = 1009,
 @iFlgInfoAdicional='info;joão;125.365.366-45'

```

#Procedure para inserir o cliente
```sql
exec PowerC.dbo.proc_agenda_telefone
 @Campanha   = 1,
 @CodCliente = '123456',
 @DDD        = 11,
 @Telefone   = 21879021,
 @DataHora   = '2017-07-26 16:45',
 @Ramal      = 1009,
 @iFlgInfoAdicional='info;joão;125.365.366-45'

```


## Duvidas

*Enviar e-mail para desenvolvimento@ipcorp.com.br







