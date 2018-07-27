// Zethr main test suite

const Zethr = artifacts.require('Zethr')
const ZethrBankroll = artifacts.require('ZethrBankroll')
const ZethrDividendCards = artifacts.require('ZethrDividendCards')

var BigNumber = require('bignumber.js')

contract('Zethr (long tests)', accounts => {

  let zethr = null
  let bankroll = null
  let divcards = null

  let divs = [2, 5, 10, 15, 20, 25, 33]

  // Before each test starts, instantiate the bankroll, divcards, and the main zethr contract
  beforeEach(async function () {
    bankroll = await ZethrBankroll.new([accounts[0]], 1)
    divcards = await ZethrDividendCards.new(bankroll.address)
    zethr = await Zethr.new(bankroll.address, divcards.address)
    await bankroll.addZethrAddresses(zethr.address, divcards.address)
  })

  // We shouldn't be able to exceed the ICO hard-cap
  it('should reject transactions exceeding the hard cap when the ICO is still active', async () => {
    await zethr.startICOPhase()

    for (let i = 0; i < 100; i++) {
      process.stdout.write('.')
      await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
        {from: accounts[i], value: web3.toWei(2.5, 'ether'), gasPrice: 5})
    }

    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'), {
      from: accounts[300],
      value: web3.toWei(1, 'ether'),
      gasPrice: 5
    }).then(function (returnValue) {
      assert(false, 'We were able to exceed the hard cap.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
    console.log(' ')
  })

  // Due to the way dividends are calculated, there will always be a small amount of ETH
  //  "locked up" in the pyramid. Let's ensure it falls below the minimum, and let's also make sure
  //  that everyone can buy in AND sell out correctly.
  it('should have a small contract balance after a mass sell-off, and token amounts received should be correct', async () => {
    await zethr.startICOPhase()

    for (let i = 0; i < 100; i++) {
      process.stdout.write('.')

      var price = await zethr.buyPrice(10)

      await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
        {from: accounts[i], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

      var newPrice = await zethr.buyPrice(10)

      if (i < 99) {
        assert(newPrice.toString() == price.toString(),
          'price should stay the same during the ICO phase')
      }

      await zethr.totalEthereumICOReceived().then((amountReceived) => {
        assert.equal(parseFloat(web3.fromWei(amountReceived)), ((2.5 * i) + 2.5),
          'balance did not equal 2.5*accountNumberBoughtIn')
      })

      await zethr.totalEthereumBalance().then((contractTotal) => {
        assert.equal(parseFloat(web3.fromWei(contractTotal)), ((2.5 * i) + 2.5),
          'contract total did not equal ethInvestedDuringICO')
      })

      await zethr.myDividends(true, {from: accounts[i]}).then((dividends) => {
        assert.equal(parseFloat(web3.fromWei(dividends)), 0,
          'accounts should not get dividends during the ico')
      })
    }

    await zethr.totalEthereumICOReceived().then((amountReceived) => {
      assert.equal(parseFloat(web3.fromWei(amountReceived)), 250,
        'contract should have 250 eth in it at the end of the ico')
    })

    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    for (let i = 100; i < 200; i++) {
      process.stdout.write('.')

      var price = await zethr.buyPrice(0)

      await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('doesntmatter'),
        {from: accounts[i], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

      var newPrice = await zethr.buyPrice(0)

      assert(newPrice.toString > price,
        'price should go up when we buy tokens not during the ico phase')

    }

    for (let i = 199; i >= 0; i--) {
      process.stdout.write('.')

      //await zethr.myDividends(true, {from: accounts[i]}).then((dividends) => {
      //  console.log(parseFloat(web3.fromWei(dividends)));
      //})

      var tokenBalance = await zethr.getFrontEndTokenBalanceOf(accounts[i])

      let truePrice = await zethr.buyPrice(0)

      var priceBefore
      var priceAfter

      if (i != 0) { priceBefore = await zethr.sellPrice()}

      await zethr.exit({from: accounts[i]})

      if (i != 0) { priceAfter = await zethr.sellPrice()}

      if (i >= 100) {
        assert(priceBefore > priceAfter,
          'price should go down when we sell until we hit ico price')
      } else if (i < 100 && i > 0) {
        assert(priceBefore.toString() == priceAfter.toString(),
          'price should be the same before and after when selling at ico price')
      }
    }

    await zethr.theDividendsOf(true, bankroll.address).then((dividendAmount) => {
      console.log("Bankroll Dividend Total: " + parseFloat(web3.fromWei(dividendAmount)))
    })

    await zethr.balanceOf(bankroll.address).then((balance) => {
      console.log("Bankroll Token Balance: " + parseFloat(web3.fromWei(balance)))
    })

    await zethr.totalEthereumBalance().then((contractTotal) => {
      console.log("Zethr Total Balance: " + parseFloat(web3.fromWei(contractTotal)))
    })

    console.log("If you haven't uncommented out exitAll in bankroll, this will fail!");
    await bankroll.exitAll();

    await zethr.totalEthereumBalance().then((contractTotal) => {
      console.log('Contract balance: ' + parseFloat(web3.fromWei(contractTotal)))
      assert((parseFloat(web3.fromWei(contractTotal)) < 5),
        'Contract balance is > 5 eth: ' + parseFloat(web3.fromWei(contractTotal)))
    })

    console.log(' ')
  })
})
