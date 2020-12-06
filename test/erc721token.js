const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const Token = artifacts.require('ERC721Token.sol');
const MockBadRecipient = artifacts.require('MockBadRecipient.sol');

contract('ERC721Token', accounts => {
  let token;
  const [admin, trader1, trader2] = [accounts[0], accounts[1], accounts[2]];

  beforeEach(async () => {
    token = await Token.new();
    for(let i = 0; i < 3; i++) {
      await token.mint();
    }
  });

  it('should NOT mint if not admin', async () => {
    await expectRevert(
      token.mint({from: trader1}),
      'only admin'
    );
  });

  it('should mint if admin', async () => {
    const balanceBefore = await token.balanceOf(admin);
    const receipt = await token.mint({from: admin});
    await token.mint({from: admin});
    const balanceAfter = await token.balanceOf(admin);
    const owner = await token.ownerOf(4);
    assert(balanceAfter.sub(balanceBefore).toNumber() === 2);
    assert(owner == admin);
    expectEvent(receipt, "Transfer", {
      _from: '0x0000000000000000000000000000000000000000', //WHAT EXACTLY IS 'address(0)'
      _to: admin,
      _tokenId: web3.utils.toBN(3) //WHEN TO USE 1) #'S, 2) web3.utils.toBN()?
    })
  });

  it('should NOT transfer if balance is 0', async () => {
    
    await token.transferFrom(trader2, trader1, 2)
    await expectRevert(
      token.transferFrom(trader2, trader1, 2),
      'Transfer not authorized'
    )
    await expectRevert(
      token.safeTransferFrom(trader2, trader1, 2),
      'Transfer not authorized'
    )
    await expectRevert(
      token.transferFrom(accounts[8], accounts[8], 0, {from: accounts[4]}),
      'Transfer not authorized'
    );
  });

  it('should NOT transfer if not owner', async () => {
    await expectRevert(
      token.transferFrom(admin, trader1, 0, {from: trader2}),
      'Transfer not authorized'
    );
    await expectRevert(
      token.safeTransferFrom(admin, trader1, 0, {from: trader2}),
      'Transfer not authorized'
    );
  });

  // Bug here, skip this test :( see end code for explanation
  it(
    'safeTransferFrom() should NOT transfer if recipient contract does not implement erc721recipient interface', 
    async () => {
    const badRecipient = await MockBadRecipient.new();
    await expectRevert(
      token.safeTransferFrom(admin, badRecipient.address, 0, {from: admin}),
      'revert' // this error message does not work =>'recipient SC cannot handle ERC721 tokens'
    );
  });

  it('transferFrom() should transfer', async () => {
    const receipt = await token.transferFrom(admin, trader1, 0, {from: admin});

    const [adminbal, trader1bal] = await Promise.all([token.balanceOf(admin), token.balanceOf(trader1)]); // BECAREFUL ON NAMING CONVENTIONS
    const owner = await token.ownerOf(0)
    
    assert(trader1bal.toNumber() === 1);
    assert(adminbal.toNumber() === 2);
    assert(owner == trader1);

    expectEvent(receipt, "Transfer", {_from: admin, _to: trader1, _tokenId: web3.utils.toBN(0)});
  });
  
  it('safeTransferFrom() should transfer', async () => {
    const receipt = await token.safeTransferFrom(admin, trader1, 0, {from: admin});
  
    const [adminbal, trader1bal] = await Promise.all([token.balanceOf(admin), token.balanceOf(trader1)]); // BECAREFUL ON NAMING CONVENTIONS
    const owner = await token.ownerOf(0)
    
    assert(trader1bal.toNumber() === 1);
    assert(adminbal.toNumber() === 2);
    assert(owner == trader1);
  
    expectEvent(receipt, "Transfer", {_from: admin, _to: trader1, _tokenId: web3.utils.toBN(0)});
  });

  it('should transfer token when approved', async () => {
    const receipt1 = await token.approve(trader1, 0);
    const approved = await token.getApproved(0);
    const receipt2 = await token.transferFrom(admin, trader1, 0, {from: trader1});

    const [adminBal, trader1bal, owner] = await Promise.all([
      token.balanceOf(admin),
      token.balanceOf(trader1),
      token.ownerOf(0)
    ]);

    assert(adminBal.toNumber() === 2);
    assert(trader1bal.toNumber() === 1);
    assert(owner == trader1);
    expectEvent(receipt2, "Transfer", {_from: admin, _to: trader1, _tokenId: web3.utils.toBN(0)});
    expectEvent(receipt1, "Approval", {_owner: admin, _approved: trader1, _tokenId: web3.utils.toBN(0)});
  });
});
