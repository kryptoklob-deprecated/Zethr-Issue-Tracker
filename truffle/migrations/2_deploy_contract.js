const Zethr = artifacts.require('Zethr')
const ZethrBankroll = artifacts.require('ZethrBankroll')
const ZethrDividendCards = artifacts.require('ZethrDividendCards')
const Zethell = artifacts.require('Zethell')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(ZethrBankroll, [accounts[0]], 1).then(function () {
    return deployer.deploy(ZethrDividendCards, ZethrBankroll.address).then(function () {
      return deployer.deploy(Zethr, ZethrBankroll.address, ZethrDividendCards.address) 
    })
  })
}
