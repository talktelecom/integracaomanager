
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
exec PowerC.dbo.proc_insere_telefone
 @Campanha   = 1,
 @CodCliente = '123456',
 @DDD        = 11,
 @Telefone   = 21879021,
 @DataHora   = '2017-07-26 16:45',
 @Ramal      = 1009,
 @iFlgInfoAdicional='info;joão;125.365.366-45'

```


##Para importação de Mailing.
```
Use EpbxManager
go
Exec SetCampanhaDiscagem
@CampanhaId   = 12                                   ---Código de Campanha criado na criação da campanha
,@CodigoCliente   = '123'                            ---Código do cliente em sua base para poder abrir a ficha do cliente
,@Nome     = 'Teste'                                 ---Nome do cliente a ser discado
,@DDD     = 11                                       ---DDD do cliente a ser discado
,@Numero    = 34710035                               ---Número do telefone a ser discado
,@Detalhe    = 'Info1, Info2, Info3, Info4, Info5'   ---Informações adicionais a disposição do CRM 
,@RamalNumero   = Null                               -- Ou Número do Ramal para agendamento                “Número do ramal para agendamentos”
,@DataAgendamento  = Null                            -- Ou data hora do agendamento            
,@TelefoneTipo   = Null                              -- Ou Código do tipo de telefone, Para ordenar a ordem a ser discada. 
Go

```

##Para importação em lote.

```
Declare @Registros CampanhaDiscagemLoteTableParam

Insert Into @Registros
(
CodigoCliente
,Nome
,DDD
,Numero
,Detalhe
,RamalId
,RamalNumero
,DataAgendamento
)
Select 
       CodigoCliente   = '123'
,Nome     = 'Teste'
,DDD     = 11
,Numero     = 23910000
,Detalhe    = 'Info1, Info2, Info3, Info4, Info5'
,RamalId    = Null
,RamalNumero = NULL
,DataAgendamento  = Null

Exec SetCampanhaDiscagemLote
       @CampanhaId   = 38
,@UsuarioCadastro  = 1
,@Registros    = @Registros

Go

```

##Contato Negativo:

#Este processo é utilizado para invalidar um telefone que não pertence ao cliente (CPC) e continue a discar para os demais  telefones que o mesmo possuir.

```
ProcessaCampanhaReativaCliente
@CampanhaId =     ---Código da Campanha
,@CodigoCliente =  ---Código de cliente
,@Telefone =       ---Telefone a ser negativado
,@DDD =            ---DDD do telefone
```

##Remover Cliente:

#Este processo é para Remover o cliente e seus telefones das campanhas 

```
ProcessaCampanhaRemoveCliente
      @CampanhaId      = 12        ---Código da Campanha – enviar 0 para remover de todas as campanhas
      ,@CodigoCliente   = '1234'    ---Código de cliente 
      ,@CPF             = null      ---CPF do cliente
      ,@Geral           = 1        ---1 para apagar de qualquer campanha ou 0 para determinar a campanha
```

##Remover Telefone:

#Este processo é para Remover o telefone das campanhas, remover somente um determinado número de telefone

```
ProcessaCampanhaRemoveTelefone
      @CampanhaId      = 12        ---Código da Campanha – enviar 0 para remover de todas as campanhas
      ,@CodigoCliente   = '1234'    ---Código de cliente 
      ,@DDD             = 11        ---DDD do cliente   
      ,@Telefone        =34710035   ---Telefone do cliente    
      ,@Geral           = 0        ---1 para apagar de qualquer campanha ou 0 para determinar a campanha     
```

##Limpar Campanha:

#Este processo remove todos os cliente da campanha

```
LimparCampanha
      @CampanhaId                 = 12 ---Código da Campanha
      ,@ManterAgendamento           = 0 ---0 para apagar até os agendamentos e 1 para não apagar os agendamentos
```

#Retorno das ligações.

#Procedure para trazer retornos do discador, o parâmetro @CampanhaId deverá ser preenchido com a campanha desejada para o retorno.

#Para consultar por status da discagem, Utilize o parâmetro @CampanhaDiscagemStatusId, “para trazer todos os status coloque 0 no campo”.


##Exemplo

```
GetCampanhaDiscagemRetorno
@CampanhaId       =     530
,@DataInicio      =     '2018-01-01'
,@DataTermino     =     '2018-02-01'
,@LoteControle    =     Null
,@CampanhaDiscagemStatusId   =     0
,@BilheteStatusDetalheId     =     0
,@BilheteId                   =     0
```

##Retorno de ligações Manuais, receptivos.

#Para retornar ligações manuais e receptivas utilize 0 no parâmetro de campanha @CampanhaId = 0

#Para trazer por status de discagem utilize o campo @BilheteStatusDetalheId 

```
GetBilheteStatusDetalhe
```
![alt text](https://github.com/talktelecom/integracaomanager/blob/master/imagens/GetBilheteStatusDetalhe.JPG)

#Para trazer acima de um Id de ligação desejado utilize o parâmetro @BilheteId

#Para diferenciar entre ligação manual e ligação receptiva utilize o parâmetro @DirecaoId ou deixe o campo com 0 para trazer os dois status.

```
GetBilheteDirecao
```
![alt text](https://github.com/talktelecom/integracaomanager/blob/master/imagens/GetBilheteDirecao.JPG)
 
```
GetCampanhaDiscagemRetorno
@CampanhaId       =     0
,@DataInicio      =     '2018-01-01'
,@DataTermino     =     '2018-05-01'
,@LoteControle    =     Null
,@CampanhaDiscagemStatusId   =     0
,@BilheteStatusDetalheId     =     0
,@BilheteId             =     0
,@DirecaoId             =     0
```


#Retorno dos Tipos Telefones para mailing do discador.

```
GetCampanhaTelefoneTipo
```
![alt text](https://github.com/talktelecom/integracaomanager/blob/master/imagens/GetCampanhaTelefoneTipo.JPG)

 

#Status e Campanha.

```
GetCampanhaStatus
```
![alt text](https://github.com/talktelecom/integracaomanager/blob/master/imagens/GetCampanhaStatus.JPG)


#Status das Ligações.

```
GetCampanhaDiscagemStatus
```
![alt text](https://github.com/talktelecom/integracaomanager/blob/master/imagens/GetCampanhaDiscagemStatus.JPG)




##Duvidas

*Enviar e-mail para ricardo.lopes@ipcorp.com.br e diego.lubini@ipcorp.com.br







