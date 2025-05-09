/*
 * Copyright 2025 The Dapr Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
limitations under the License.
*/

package io.dapr.springboot.examples.orders;

import org.springframework.data.annotation.Id;

public class Order {

  @Id
  private String id;
  private String item;
  private Integer amount;
  private String workflowId;
  private Boolean inStock = false;
  private Boolean isShipped = false;


  public Order() {
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getItem() {
    return item;
  }

  public void setItem(String item) {
    this.item = item;
  }

  public Integer getAmount() {
    return amount;
  }

  public void setAmount(Integer amount) {
    this.amount = amount;
  }

  public String getWorkflowId() {
    return workflowId;
  }

  public void setWorkflowId(String workflowId) {
    this.workflowId = workflowId;
  }

  public Boolean getInStock() {
    return inStock;
  }

  public void setInStock(Boolean inStock) {
    this.inStock = inStock;
  }

  public Boolean getShipped() {
    return isShipped;
  }

  public void setShipped(Boolean shipped) {
    isShipped = shipped;
  }

  @Override
  public String toString() {
    return "Order{" +
            "id='" + id + '\'' +
            ", item='" + item + '\'' +
            ", amount=" + amount +
            ", workflowId='" + workflowId + '\'' +
            ", inStock=" + inStock +
            ", isShipped=" + isShipped +
            '}';
  }
}
