const connection = require('../utils/db.js');

module.exports.checkCard = async function(req, res){
    connection.execute(
        'SELECT mac from IndirizziMAC WHERE mac=?',
        [req.params.mac],
        function(err, results, fields) {
            if (results.length > 0 && results[0]['mac'] == req.params.mac) {
                connection.execute(
                    'SELECT idtessera, ruolo, limite from tessere WHERE idtessera=?',
                    [req.params.id],
                    function(err, results, fields) {
                        if (results.length > 0 && results[0]['idtessera'] == req.params.id) {
                            dataNow = new Date().toISOString().slice(0, 10);
                            connection.execute( // se l'idtessera esiste faccio partire la connessione al db
                            // per verificare se il numero massimo di timbrature giornaliere è stato raggiunto
                                `SELECT data FROM ingressi WHERE data = (SELECT MAX(data) FROM ingressi) AND idtessera = ${req.params.id} ORDER BY data DESC`,
                                // faccio una query innestata: nella query interna chiedo la data più recente
                                // nella query esterna prendo tutte le date relative all'idtessera e all'ultima data
                                [],
                                function(err, resData, fields) {
                                    check = true;
                                    if(resData.length > 0) { // se esistono delle timbrature
                                        for(i = 0; i < dataNow.length && check; ++i) { // ciclo per verificare se oggi ha già effettuato timbrature
                                            if(dataNow[i] != resData[0]['data'][i]) {
                                                check = false; // confronto l'ultima data salvata a db con quella odierna
                                            }
                                        } 
                                        // check == false se oggi non c'è ancora stata una timbratura
                                        if(check) { // se oggi ci sono già state timbrature
                                            countNBadge = 0;
                                            for(; countNBadge < resData.length; ++countNBadge); // conto il numero di timbrature

                                            if(countNBadge < Number(results[0]['limite'])) { // se posso fare ancora timbrature
                                                check = false;
                                            }
                                            else {
                                                res.send("Numero massimo di timbrature raggiunto");
                                            }
                                        }
                                    }
                                    else {
                                        check = false; // se non ci sono salvate timbrature sul db relative alla tessera inserita
                                        // check == false così può inserire la timbratura a db
                                    }
                                    if(!check) {
                                        const data = new Date().toISOString().slice(0, 10);
                                        const orario = new Date().toLocaleTimeString();
                                        connection.execute(
                                            'INSERT INTO ingressi (idtessera, data, orario) VALUES (?, ?, ?)',
                                            [req.params.id, data, orario],
                                            function(insertErr, insertResults, insertFields) {
                                                if (insertErr) {
                                                    console.error(insertErr);
                                                    return res.status(500).send('Registrazione ingresso non riuscita');
                                                }
                                                res.status(200).send('Ingresso registrato');
                                            }
                                        )
                                    }
                                }
                            )
                            
                        }
                        else {
                            res.status(404).send('Tessera non riconosciuta');
                        }
                    }
                )
            }
            else{
                res.status(404).send('MAC address non riconosciuto')
            }
        }
    )
}


module.exports.addNewCard = async function(req, res) {
    connection.execute(
        'SELECT mac from IndirizziMAC WHERE mac=?',
        [req.params.mac],
        function(err, results, fields) {

            if (results.length > 0 && results[0]['mac'] == req.params.mac) {
                connection.execute(
                    'SELECT idtessera FROM tessere WHERE idtessera = ?',
                    [req.params.id],
                    function(err, results, fields) {

                        if(results.length > 0) {
                            res.setHeader('Content-Type', 'text/plain');
                            res.send("ERRORE! Tessera già esistente!");
                        }
                        else {
                            connection.execute(
                                'INSERT INTO tessere(idtessera, nome, cognome, ruolo) VALUES (?, ?, ?, ?)',
                                [req.params.id, req.params.nome, req.params.cognome, req.params.ruolo]
                            )
                            res.setHeader('Content-Type', 'text/plain');
                            res.send("Carta aggiunta con successo!");
                        }
                    }
                )
            }
            else{
                res.status(404).send('MAC address non riconosciuto')
            } 
        }
    )
}


module.exports.limitAcces = async function(req, res) {
    connection.execute(
        'SELECT mac from IndirizziMAC WHERE mac=?',                                  //controlla che il mac address ci sia
        [req.params.mac],
        function(err, results, fields) {
            
            if (results.length > 0 && results[0]['mac'] == req.params.mac) {
                connection.execute(
                    `UPDATE tessere SET limite = ? WHERE idtessera = ?`,
                    [req.params.limit, req.params.idtessera],
                    function(err, results, fields) {
                        res.setHeader('Content-Type', 'text/plain');
                        if(!err) {
                            res.send("Limite numero di accessi inserito");
                        }
                        else {
                            res.send(err);
                        }
                    }
                )
            }    
            else{                                                                    //se non c'è macAddress allora errore
                res.status(404).send('MAC address non riconosciuto')
            } 
        }
    )
}


module.exports.deleteCard = async function(req, res) {
    connection.execute(
        'SELECT mac from IndirizziMAC WHERE mac=?',                                  //controlla che il mac address ci sia
        [req.params.mac],
        function(err, results, fields) {

            if (results.length > 0 && results[0]['mac'] == req.params.mac) {         //se c'è macaddress cerca la tessera a db
                connection.execute(
                    'SELECT idtessera FROM tessere WHERE idtessera = ?',
                    [req.params.id],
                    function(err, results, fields) {

                        if(results.length > 0) {                                     //se tessera c'è allora cancellala
                            connection.execute(
                                'DELETE FROM tessere WHERE idtessera=?',
                                [req.params.id]
                            )
                            res.setHeader('Content-Type', 'text/plain');
                            res.send("Carta eliminata con successo!");
                        }
                        else {                                                       //se tessera non c'è allora errore
                            res.setHeader('Content-Type', 'text/plain');
                            res.send("ERRORE! Tessera non presente!");
                        }
                    }
                )
            }
            else{                                                                    //se non c'è macAddress allora errore
                res.status(404).send('MAC address non riconosciuto')
            } 
        }
    )
}

module.exports.getData = function(req, res) {
    connection.execute(
        `SELECT mac from IndirizziMAC WHERE mac=?`,
        [req.params.mac],
        function(err, results, fields) {
            if(results.length > 0 && results[0]['mac'] == req.params.mac) {
                connection.execute(
                    `SELECT i.data, i.orario FROM ingressi i JOIN tessere t ON i.idtessera = t.idtessera WHERE t.nome = ? AND t.cognome = ?`,
                    [req.params.nome, req.params.cognome],
                    function(err, results, fields) {
                        res.json(results);
                    }
                )
            }
            else {
                res.send("Mac address non riconosciuto");
            }
        }
    )
}
